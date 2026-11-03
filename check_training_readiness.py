#!/usr/bin/env python3
"""Check local prerequisites for reproducible model training and evaluation."""

from __future__ import annotations

import importlib.util
import re
import shutil
import subprocess
import sys
from pathlib import Path

from src.common.config import load_config


def java_status() -> tuple[bool, str]:
    java = shutil.which("java")
    if not java:
        return False, "Java executable not found on PATH"

    try:
        result = subprocess.run(
            [java, "-version"],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"Could not query Java version: {exc}"

    output = result.stderr or result.stdout
    match = re.search(r'version "([0-9]+)(?:\.([0-9]+))?', output)
    if result.returncode != 0 or not match:
        return False, f"Could not determine Java version: {output.strip() or 'no version output'}"

    major = int(match.group(1))
    minor = int(match.group(2) or 0)
    version = f"{major}.{minor}" if major == 1 else str(major)
    if major == 1:
        supported = minor >= 8
    else:
        supported = major >= 8
    return supported, f"Java {version}"


def main() -> int:
    config = load_config()
    root = Path(__file__).resolve().parent
    required_datasets = {
        "Classifier training dataset": Path(config["paths"]["classifier_dataset"]),
        "Regression training dataset": Path(config["paths"]["regression_dataset"]),
    }
    reference_file = Path(config["paths"]["reference_ablation"])
    model_paths = {
        "Classifier DRF": root / "models/classifier_final_drf/drf_model.zip",
        "On-time regressor": root / "models/regressor_ontime/ontime_regressor.zip",
        "Delayed regressor": root / "models/regressor_delayed/delayed_regressor.zip",
        "Baseline regressor": root / "models/regressor_baseline/baseline_regressor.zip",
    }

    print("Justice AI training readiness")
    print(f"Python: {sys.version.split()[0]} ({'supported' if sys.version_info >= (3, 10) else 'too old'})")

    java_ok, java_message = java_status()
    print(f"Java: {java_message} ({'available' if java_ok else 'required'})")

    h2o_available = importlib.util.find_spec("h2o") is not None
    print(f"H2O Python package: {'installed' if h2o_available else 'missing'}")

    datasets_ready = True
    for label, path in required_datasets.items():
        exists = path.is_file()
        datasets_ready = datasets_ready and exists
        print(f"{label}: {'found' if exists else 'MISSING'} - {path}")

    reference_exists = reference_file.is_file()
    print(f"Reference ablation results: {'found' if reference_exists else 'not included'} - {reference_file}")

    available_models = 0
    for label, path in model_paths.items():
        exists = path.is_file()
        available_models += int(exists)
        print(f"{label}: {'found' if exists else 'not installed'}")

    training_ready = sys.version_info >= (3, 10) and java_ok and h2o_available and datasets_ready
    if training_ready:
        print("\nTraining prerequisites are present. Run: python run_pipeline.py")
        return 0

    blockers = []
    if sys.version_info < (3, 10):
        blockers.append("Python 3.10 or newer")
    if not java_ok:
        blockers.append("Java 8 or newer")
    if not h2o_available:
        blockers.append("H2O Python package (install full requirements.txt)")
    if not datasets_ready:
        blockers.append("licensed classifier and regression CSVs at the configured paths")

    print("\nTraining is not ready. Missing prerequisites:")
    for blocker in blockers:
        print(f"- {blocker}")
    if available_models == 0:
        print("No trained local models are present; app predictions use the labeled research-benchmark fallback.")
    if not reference_exists:
        print("The precomputed hybrid evaluation is also unavailable without the reference ablation results file.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())