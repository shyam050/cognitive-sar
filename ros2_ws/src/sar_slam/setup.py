from setuptools import find_packages, setup

package_name = "sar_slam"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages",
         ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/config", ["config/slam_toolbox.yaml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="SAR Team",
    maintainer_email="sar-team@example.com",
    description="Per-robot SLAM config and multi-robot map fusion (O1).",
    license="MIT",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "map_merge = sar_slam.map_merge_node:main",
        ],
    },
)
