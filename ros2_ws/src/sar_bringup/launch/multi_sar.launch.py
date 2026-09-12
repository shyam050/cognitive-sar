"""One-command multi-robot SAR mission.

    ros2 launch sar_bringup multi_sar.launch.py robots:=3 allocator:=rule
    ros2 launch sar_bringup multi_sar.launch.py robots:=3 allocator:=rl \
        checkpoint:=<path to training/runs/<run>/checkpoint_best.pt>

Starts Gazebo with the SAR world, then for each robot: robot_state_publisher,
gz bridge, spawn, odom->tf, slam_toolbox, YOLO detector and (optionally) Nav2.
Shared: map fusion, frontier/regions, semantic memory, allocator, evaluator.
"""

import os
import subprocess
import tempfile

import yaml
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, OpaqueFunction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _render_nav2_params(template_path, robot, out_dir):
    with open(template_path) as f:
        text = f.read()
    path = os.path.join(out_dir, f"nav2_{robot}.yaml")
    with open(path, "w") as f:
        f.write(text.replace("{ROBOT}", robot))
    return path


def _launch_setup(context, *args, **kwargs):
    n_robots = int(LaunchConfiguration("robots").perform(context))
    allocator = LaunchConfiguration("allocator").perform(context)
    checkpoint = LaunchConfiguration("checkpoint").perform(context)
    use_nav2 = LaunchConfiguration("use_nav2").perform(context).lower() in ("1", "true")
    with_rviz = LaunchConfiguration("rviz").perform(context).lower() in ("1", "true")
    world_arg = LaunchConfiguration("world").perform(context)

    sar_worlds = get_package_share_directory("sar_worlds")
    sar_robot = get_package_share_directory("sar_robot")
    sar_slam = get_package_share_directory("sar_slam")
    sar_nav = get_package_share_directory("sar_nav")
    sar_eval = get_package_share_directory("sar_eval")

    world = (world_arg if world_arg and world_arg != "default"
             else os.path.join(sar_worlds, "worlds", "sar_world.sdf"))
    ground_truth = os.path.join(sar_eval, "config", "ground_truth.yaml")
    with open(ground_truth) as f:
        spawns = yaml.safe_load(f)["robot_spawns"]

    robots = [f"robot_{i + 1}" for i in range(n_robots)]
    slam_yaml = os.path.join(sar_slam, "config", "slam_toolbox.yaml")
    nav2_template = os.path.join(sar_nav, "config", "nav2_params_template.yaml")
    rviz_cfg = os.path.join(get_package_share_directory("sar_bringup"),
                            "config", "sar_default.rviz")
    tmpdir = tempfile.mkdtemp(prefix="sar_launch_")
    actions = []

    # ---------------------------------------------------------------- gazebo
    actions.append(IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(
            get_package_share_directory("ros_gz_sim"), "launch", "gz_sim.launch.py")),
        launch_arguments={"gz_args": f"-r {world}"}.items()))

    for i, name in enumerate(robots):
        x, y, yaw = spawns[i % len(spawns)]
        urdf = subprocess.check_output(
            ["xacro", os.path.join(sar_robot, "urdf", "sar_bot.urdf.xacro"),
             f"name:={name}"], text=True)
        urdf_path = os.path.join(tmpdir, f"{name}.urdf")
        with open(urdf_path, "w") as f:
            f.write(urdf)

        actions.append(Node(
            package="robot_state_publisher", executable="robot_state_publisher",
            parameters=[{"robot_description": urdf, "use_sim_time": True}],
            output="screen"))
        actions.append(Node(
            package="ros_gz_sim", executable="create",
            arguments=["-world", "sar_world", "-file", urdf_path, "-name", name,
                       "-x", str(x), "-y", str(y), "-z", "0.05", "-Y", str(yaw)],
            output="screen"))
        actions.append(Node(
            package="ros_gz_bridge", executable="parameter_bridge",
            arguments=[
                f"/{name}/cmd_vel@geometry_msgs/msg/Twist[gz.msgs.Twist",
                f"/{name}/odom@nav_msgs/msg/Odometry]gz.msgs.Odometry",
                f"/{name}/scan@sensor_msgs/msg/LaserScan]gz.msgs.LaserScan",
                f"/{name}/image_raw@sensor_msgs/msg/Image]gz.msgs.Image",
                f"/{name}/camera_info@sensor_msgs/msg/CameraInfo]gz.msgs.CameraInfo",
            ],
            output="screen"))
        actions.append(Node(
            package="sar_bringup", executable="odom_tf",
            parameters=[{"robot": name, "use_sim_time": True}], output="screen"))
        actions.append(Node(
            package="slam_toolbox", executable="async_slam_toolbox_node",
            name="slam_toolbox",
            parameters=[slam_yaml,
                        {"use_sim_time": True,
                         "base_frame": f"{name}_base_link",
                         "odom_frame": f"{name}_odom",
                         "scan_topic": f"/{name}/scan"}],
            remappings=[("/map", f"/{name}/map")], output="screen"))
        actions.append(Node(
            package="sar_perception", executable="detector",
            parameters=[{"robot": name,
                         "image_topic": f"/{name}/image_raw",
                         "scan_topic": f"/{name}/scan",
                         "base_frame": f"{name}_base_link",
                         "use_sim_time": True}], output="screen"))
        if use_nav2:
            actions.append(IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(
                    get_package_share_directory("nav2_bringup"), "launch",
                    "navigation_launch.py")),
                launch_arguments={
                    "namespace": name,
                    "params_file": _render_nav2_params(nav2_template, name, tmpdir),
                    "use_sim_time": "True",
                    "autostart": "True",
                    "use_composition": "False",
                }.items()))

    # ------------------------------------------------------- shared cognition
    spawn_flat = []
    for i in range(n_robots):
        x, y, yaw = spawns[i % len(spawns)]
        spawn_flat += [float(x), float(y), float(yaw)]
    actions.append(Node(
        package="sar_slam", executable="map_merge",
        parameters=[{"robots": robots, "spawn_poses": spawn_flat,
                     "use_sim_time": True}], output="screen"))
    actions.append(Node(
        package="sar_nav", executable="frontier",
        parameters=[{"use_sim_time": True}], output="screen"))
    actions.append(Node(
        package="sar_memory", executable="semantic_memory",
        parameters=[{"use_sim_time": True}], output="screen"))

    if allocator == "rl":
        if not checkpoint:
            raise RuntimeError("allocator:=rl requires checkpoint:=<path>")
        actions.append(Node(
            package="sar_alloc_rl", executable="rl_allocator",
            parameters=[{"robots": robots, "checkpoint": checkpoint,
                         "use_sim_time": True}], output="screen"))
    else:
        actions.append(Node(
            package="sar_alloc_rule", executable="rule_allocator",
            parameters=[{"robots": robots, "use_sim_time": True}], output="screen"))

    actions.append(Node(
        package="sar_eval", executable="eval",
        parameters=[{"robots": robots, "ground_truth": ground_truth,
                     "use_sim_time": True}], output="screen"))

    if with_rviz:
        actions.append(Node(
            package="rviz2", executable="rviz2",
            arguments=["-d", rviz_cfg], output="screen"))
    return actions


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument("robots", default_value="3"),
        DeclareLaunchArgument("allocator", default_value="rule"),
        DeclareLaunchArgument("checkpoint", default_value=""),
        DeclareLaunchArgument("world", default_value="default"),
        DeclareLaunchArgument("use_nav2", default_value="true"),
        DeclareLaunchArgument("rviz", default_value="true"),
        OpaqueFunction(function=_launch_setup),
    ])
