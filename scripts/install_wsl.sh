#!/usr/bin/env bash
# One-shot environment setup for the SAR project inside WSL (Ubuntu 24.04).
# Run:  bash scripts/install_wsl.sh
set -euo pipefail

echo "==> ROS 2 Jazzy + Gazebo Harmonic + project dependencies"

sudo apt update
sudo apt install -y \
  curl git build-essential python3-pip python3-colcon-common-extensions \
  ros-dev-tools lsb-release gnupg

# ROS 2 Jazzy apt repo
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
  -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" \
  | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update

sudo apt install -y \
  ros-jazzy-desktop \
  ros-jazzy-ros-gz \
  ros-jazzy-slam-toolbox \
  ros-jazzy-navigation2 \
  ros-jazzy-nav2-bringup \
  ros-jazzy-xacro \
  ros-jazzy-robot-state-publisher \
  ros-jazzy-cv-bridge \
  ros-jazzy-tf-transformations

# Python side (user install)
echo "==> Python packages (training stack)"
pip3 install --user -r "$(dirname "$0")/../training/requirements.txt"

# Optionally install YOLO weights/deps (heavier, optional for the HSV detector)
# pip3 install --user ultralytics

# Source ROS in future shells
if ! grep -q "source /opt/ros/jazzy/setup.bash" ~/.bashrc; then
  echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc
  echo "==> added ROS sourcing to ~/.bashrc"
fi

echo "==> Done. Open a new shell, then:"
echo "     cd ros2_ws && colcon build --symlink-install && source install/setup.bash"
echo "     ros2 launch sar_bringup multi_sar.launch.py robots:=3 allocator:=rule"
