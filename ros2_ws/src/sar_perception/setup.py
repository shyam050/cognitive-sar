from setuptools import find_packages, setup

package_name = "sar_perception"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="SAR Team",
    maintainer_email="sar-team@example.com",
    description="Victim/hazard detection projected into the map frame (O2).",
    license="MIT",
    tests_require=["pytest"],
    entry_points={"console_scripts": ["detector = sar_perception.detector_node:main"]},
)
