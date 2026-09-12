from setuptools import find_packages, setup

package_name = "sar_bringup"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/launch", ["launch/multi_sar.launch.py"]),
        ("share/" + package_name + "/config", ["config/sar_default.rviz"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="SAR Team",
    maintainer_email="sar-team@example.com",
    description="Multi-robot SAR mission launch and helpers.",
    license="MIT",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": ["odom_tf = sar_bringup.odom_tf_node:main"],
    },
)
