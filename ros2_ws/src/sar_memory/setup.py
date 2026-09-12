from setuptools import find_packages, setup

package_name = "sar_memory"

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
    description="Shared semantic map / cognitive memory layer (O3).",
    license="MIT",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": ["semantic_memory = sar_memory.semantic_memory_node:main"],
    },
)
