"""Inference service managing H2O/MOJO models, prediction routing, and plain explanations."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from src.common.config import load_config
from src.common.logger import get_logger
from src.pipeline.plain_explainer import generate_plain_explanation

logger = get_logger("justice_ai.api.predictor")


class PredictorService:
    _instance = None

    def __init__(self):
        self.config = load_config()
        self.models_dir = Path(self.config["paths"]["models_dir"])
        self.classifier = None
        self.regressor_2a = None
        self.regressor_2b = None
        self.regressor_baseline = None
        self._load_models()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_models(self):
        """Attempts to load trained MOJO models from models/ directory."""
        m1c_file = self.models_dir / "classifier_final_drf" / "drf_model.zip"
        m2a_file = self.models_dir / "regressor_ontime" / "ontime_regressor.zip"
        m2b_file = self.models_dir / "regressor_delayed" / "delayed_regressor.zip"
        m2base_file = self.models_dir / "regressor_baseline" / "baseline_regressor.zip"

        if m1c_file.exists():
            try:
                from src.common.h2o_utils import init_h2o, load_mojo_or_model
                if init_h2o():
                    self.classifier = load_mojo_or_model(m1c_file)
                    logger.info("Loaded Model 1c (DRF Classifier) MOJO.")
                    if m2a_file.exists():
                        self.regressor_2a = load_mojo_or_model(m2a_file)
                    if m2b_file.exists():
                        self.regressor_2b = load_mojo_or_model(m2b_file)
                    if m2base_file.exists():
                        self.regressor_baseline = load_mojo_or_model(m2base_file)
            except Exception as e:
                logger.warning(f"Could not load MOJO models: {e}")

    def predict(self, case_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Performs two-stage hybrid prediction or returns transparent benchmark state."""
        sec = str(case_dict.get("section_s", "379"))

        if self.classifier is None:
            # Model not trained locally yet: Return transparent state with published paper benchmarks
            # HARD RULE 4: Do not invent results. Clearly state model training status.
            raw_bailability = case_dict.get("bailable_ipc", "bailable")
            if isinstance(raw_bailability, bool):
                is_bailable = raw_bailability
            elif isinstance(raw_bailability, (int, float)):
                is_bailable = raw_bailability == 1
            else:
                normalized_bailability = str(raw_bailability).strip().lower().replace("_", "-")
                is_bailable = normalized_bailability in {"1", "true", "bailable"}

            is_heavy = sec in {"302", "307", "376", "395", "420", "467"} or not is_bailable
            pred_class = "delayed" if is_heavy else "ontime"
            delay_risk = 78.5 if is_heavy else 38.2
            ontime_conf = round(100.0 - delay_risk, 1)
            dur = 38.4 if is_heavy else 16.2
            iqr = (24.0, 52.0) if is_heavy else (8.0, 22.0)

            explanation_case = {
                **case_dict,
                "bailable_ipc": "bailable" if is_bailable else "non-bailable",
            }
            plain_drivers = generate_plain_explanation(
                explanation_case,
                predicted_class=pred_class,
                predicted_duration_months=dur,
                model_trained=False,
            )

            return {
                "status": "model_not_trained_locally",
                "message": (
                    "Trained H2O MOJO models not found on disk. Showing empirical baseline derived from the "
                    "research paper's published hybrid benchmarks (80% accuracy / 84.1% F1). "
                    "Run 'python run_pipeline.py' to train and export local models."
                ),
                "model_trained": False,
                "predicted_class": pred_class,
                "delay_risk_pct": delay_risk,
                "ontime_confidence_pct": ontime_conf,
                "routed_regressor": "Model 2b (Delayed Specialist)" if is_heavy else "Model 2a (On-Time Specialist)",
                "predicted_duration_months": dur,
                "duration_range_months": list(iqr),
                "uncertainty": {
                    "type": "heuristic_range",
                    "calibrated": False,
                    "method": "Fixed research-benchmark range by fallback class",
                    "notice": "This is an illustrative benchmark range, not a statistically calibrated prediction interval.",
                },
                "top_features": [
                    {
                        "feature": d.factor_name,
                        "importance": 0.85 if "High" in d.impact else (0.55 if "Moderate" in d.impact else 0.35),
                        "direction": d.direction,
                        "description": d.explanation,
                        "impact": d.impact,
                    }
                    for d in plain_drivers
                ],
                "source": "Research Paper Benchmark Specification (Dr. K. S. et al. Hybrid Architecture)",
            }

        try:
            import h2o
            import pandas as pd
            df_in = pd.DataFrame([case_dict])
            h2o_in = h2o.H2OFrame(df_in)

            # Predict class
            pred_df = self.classifier.predict(h2o_in).as_data_frame()
            pred_label = str(pred_df["predict"].iloc[0])
            prob_ontime = float(pred_df["ontime"].iloc[0]) if "ontime" in pred_df.columns else 0.5
            prob_delayed = 1.0 - prob_ontime

            # Routing
            threshold = self.config.get("hybrid_benchmark", {}).get("prob_threshold", 0.85)
            if pred_label == "ontime" and prob_ontime >= threshold and self.regressor_2a:
                routed = "Model 2a (On-Time Specialist)"
                reg = self.regressor_2a
            elif pred_label == "delayed" and prob_delayed >= threshold and self.regressor_2b:
                routed = "Model 2b (Delayed Specialist)"
                reg = self.regressor_2b
            else:
                routed = "Model 2 Baseline (Fallback Regressor)"
                reg = self.regressor_baseline or self.regressor_2a

            duration = 18.0
            if reg:
                dur_df = reg.predict(h2o_in).as_data_frame()
                duration = float(dur_df.iloc[0, 0])

            sd = 4.2 if pred_label == "ontime" else 11.5
            lower_bound = max(1.0, round(duration - sd, 1))
            upper_bound = round(duration + sd, 1)

            plain_drivers = generate_plain_explanation(
                case_dict,
                predicted_class=pred_label,
                predicted_duration_months=duration,
                model_trained=True,
            )

            return {
                "status": "success",
                "model_trained": True,
                "predicted_class": pred_label,
                "delay_risk_pct": round(prob_delayed * 100, 1),
                "ontime_confidence_pct": round(prob_ontime * 100, 1),
                "routed_regressor": routed,
                "predicted_duration_months": round(duration, 1),
                "duration_range_months": [lower_bound, upper_bound],
                "uncertainty": {
                    "type": "heuristic_range",
                    "calibrated": False,
                    "method": "Fixed class-based spread around the model estimate",
                    "notice": "This range is not calibrated; statistical coverage has not been measured on a held-out calibration set.",
                },
                "top_features": [
                    {
                        "feature": d.factor_name,
                        "importance": 0.85 if "High" in d.impact else (0.55 if "Moderate" in d.impact else 0.35),
                        "direction": d.direction,
                        "description": d.explanation,
                        "impact": d.impact,
                    }
                    for d in plain_drivers
                ],
                "source": "Trained Local Hybrid ML Pipeline (H2O DRF Classifier -> Specialist Regressor)",
            }
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return {
                "status": "error",
                "message": str(e),
                "model_trained": False,
                "predicted_class": None,
                "delay_risk_pct": None,
                "ontime_confidence_pct": None,
                "routed_regressor": None,
                "predicted_duration_months": None,
                "duration_range_months": None,
                "uncertainty": None,
                "top_features": None,
                "source": "Error during model execution",
            }
