cmake_minimum_required(VERSION 3.8)
project(sar_msgs)

find_package(ament_cmake REQUIRED)
find_package(builtin_interfaces REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(rosidl_default_generators REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/SemanticEntry.msg"
  "msg/SemanticMap.msg"
  "msg/Region.msg"
  "msg/RegionArray.msg"
  "msg/MissionMetrics.msg"
  "srv/QuerySemanticMap.srv"
  DEPENDENCIES builtin_interfaces geometry_msgs std_msgs
)

ament_export_dependencies(rosidl_default_runtime)
ament_package()
