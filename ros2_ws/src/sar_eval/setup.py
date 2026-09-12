from setuptools import find_packages, setup

package_name = "sar_eval"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/config", ["config/ground_truth.yaml"]),
    ],
    scripts=["scripts/plot_results.py"],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="SAR Team",
    maintainer_email="sar-team@example.com",
    description="Metric collection and experiment output (O5).",
    license="MIT",
    tests_require=["pytest"],
    entry_points={"console_scripts": ["eval = sar_eval.eval_node:main"]},
)
