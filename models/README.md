# Trained Models Architecture (Justice AI)

This directory houses the trained model artifacts for the two-stage hybrid decision architecture:

```text
models/
├── classifier_final_drf/      # Stage 1: H2O Distributed Random Forest (DRF) delay classifier
├── regressor_ontime/          # Stage 2a: Specialist H2O AutoML duration regressor (<= 24 months)
├── regressor_delayed/         # Stage 2b: Specialist H2O AutoML duration regressor (> 24 months)
└── regressor_baseline/        # Baseline: Monolithic fallback regressor for low-confidence routing
```

## Model Training & Inference

- **Stage 1 (Classifier)**: Predicts binary delay likelihood (`ontime` vs. `delayed`) with ~80% accuracy and ~84.1% F1 score.
- **Routing Protocol**: Cases with class probability $p \ge 0.85$ are routed to the designated specialist regressor (Model 2a for on-time, Model 2b for delayed). Cases in the disagreement region fall back to the monolithic baseline model.
- **Stage 2 (Specialist Regressors)**: Optimized regressors achieving RMSE of ~4.90 months (on-time) and ~13.79 months (delayed).

To train or re-evaluate models, run:
```bash
python run_pipeline.py --stage all
```
