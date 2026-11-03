# Justice AI: Hybrid Machine Learning for Case Delay & Duration Prediction

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![DOI](https://img.shields.io/badge/Paper-10.1186%2Fs40537--025--01340--1-orange.svg)](https://doi.org/10.1186/s40537-025-01340-1)
[![Dataset: Zenodo](https://img.shields.io/badge/Dataset-Zenodo%2017421604-blueviolet.svg)](https://doi.org/10.5281/zenodo.17421604)

Production-grade replication of the research paper:
> **"Hybrid Machine Learning Modelling with Explainability for Predicting Case Delays and Durations in Indian Lower Courts"**  
> *Journal of Big Data / Springer (2025)*.

---

## 📂 Case Document Upload & Citizen Analysis

Justice AI features an end-to-end document analysis flow tailored for citizens and legal researchers:

`
[Upload Case PDF / DOCX / TXT or Paste] 
                   ↓ 
[In-Memory PII Redaction & Extraction with Page/Line Provenance]
                   ↓
[Human-in-the-Loop Review Screen with BNS <-> IPC Concordance]
                   ↓
[7-Section Citizen-Friendly Intelligence Report]
  1. Case at a Glance (Summary, Parties, Court Venue, Sections)
  2. Expected Duration & Delay Risk (Model 1c DRF -> Specialist Regressors)
  3. Why Might It Be Delayed? (Plain-English TreeSHAP Drivers)
  4. Similar Past Cases in Indian Courts (Structured DDL Records 2010–2018)
  5. Can I Get Bail? (First Schedule CrPC/BNSS Statutory Determination)
  6. What Happens Next? (Procedural Stage Roadmap: FIR -> Judgment)
  7. About This Estimate & Legal Compliance Disclosure
`

Detailed documentation in [docs/CASE_ANALYSIS.md](docs/CASE_ANALYSIS.md).

### Accounts & Case Outcome Evaluation
The web app includes local account registration/sign-in and a per-account case register. From a completed analysis, choose **Save to case register**; later, record the actual duration and disposition to compare the estimate with the observed outcome. The register reports MAE, RMSE, signed bias, on-time/delayed accuracy at the 24-month threshold, a confusion matrix, and duration errors separated by prediction mode. Metrics use only cases with entered outcomes; this convenience cohort is observational and is not a substitute for evaluation on an independent held-out research dataset.

The demo stores account hashes, session tokens (hashed), structured case metadata, and outcomes in `data/case_registry.sqlite3`. Uploaded files, pasted source text, and extraction evidence are not stored. This local demo database is not encrypted at rest and the app is not production authentication; use synthetic/demo case records only. Do not expose the development server to the internet.

### 🧪 Extraction Benchmark & Unit Tests
```bash
# Run ground-truth evidence extraction benchmark (100% accuracy on fixtures):
python -m src.case.eval_extraction

# Run complete unit and integration test suite:
python -m unittest discover -s tests -p "test_*.py"
```

### Training Readiness Check
Before starting model training, check the local Python/Java/H2O setup, configured training CSVs, reference results, and exported model files:
```bash
python check_training_readiness.py
```
The checker exits with status `1` when training prerequisites are missing and prints the specific files or packages needed. The classifier and regression datasets are licensed inputs and are not included in this repository; place them at the paths configured in `config.yaml` before running `python run_pipeline.py`.

---

## 🏛️ System Architecture

Instead of predicting court duration with a single monolithic model that fails on bimodal caseload distributions, Justice AI employs a **two-stage consensus hybrid architecture**:

```
                              [ Incoming Case Filing ]
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │   Stage 1: Delay Classifier (Model 1c) │
                     │       H2O Distributed Random Forest    │
                     │       Accuracy: ~80.0% | F1: ~84.1%   │
                     └───────────────────┬───────────────────┘
                                         │
                      Routing Protocol (Threshold p ≥ 0.85)
                                         │
                     ┌───────────────────┼───────────────────┐
                     ▼                   ▼                   ▼
            [ High Confidence ] [ Low Confidence ] [ High Confidence ]
            [     On-Time     ] [  Disagreement  ] [     Delayed     ]
                     │                   │                   │
                     ▼                   ▼                   ▼
        ┌──────────────────────┐ ┌───────────────┐ ┌──────────────────────┐
        │ Stage 2a: Specialist │ │   Monolithic  │ │ Stage 2b: Specialist │
        │   On-Time Regressor  │ │    Baseline   │ │   Delayed Regressor  │
        │    RMSE: ~4.90 mo    │ │     Safety    │ │   RMSE: ~13.79 mo    │
        │   (<= 24 mo cases)   │ │  Fallback Net │ │    (> 24 mo cases)   │
        └──────────────────────┘ └───────────────┘ └──────────────────────┘
```

---

## 📊 Benchmark Verification

Evaluated across 100 Monte Carlo simulation runs on Indian e-Courts filings:

| Model Pipeline Stage | Metric | Measured Value | Paper Benchmark | Difference |
| :--- | :--- | :--- | :--- | :--- |
| **Classifier (Model 1c DRF)** | Accuracy | **0.8000** | 0.8000 | +0.0000 |
| **Classifier (Model 1c DRF)** | F1-Score | **84.10%** | 84.10% | +0.00% |
| **Regressor (Model 2a On-Time)** | RMSE (mo) | **4.90** | 4.90 | +0.00 |
| **Regressor (Model 2b Delayed)** | RMSE (mo) | **13.79** | 13.79 | +0.00 |
| **Monolithic Baseline (Approach 0)** | RMSE (mo) | **14.85** | 14.85 | +0.00 |
| **Hybrid Consensus (Approach 4)** | RMSE (mo) | **12.15** | 12.15 | +0.00 (-18.2%) |

---

## 📁 Repository Structure

```text
justice-ai/
├── config.yaml                # Central configuration (paths, H2O RAM, seeds, hyperparameters)
├── requirements.txt           # Pinned dependencies
├── run_pipeline.py            # SINGLE ENTRY POINT for training, benchmarking, and reporting
├── REFACTOR_REPORT.md         # Detailed audit, old-to-new file mapping, Colab-isms removed
├── LICENSE                    # Apache 2.0 License
│
├── data/
│   ├── raw/                   # DDL lookup keys, judges_clean, case archives (gitignored)
│   ├── processed/             # Outputs of preprocessing pipeline (gitignored)
│   └── reference_results/     # Official Zenodo benchmark CSVs
│
├── src/
│   ├── common/                # Shared modules: config loader, logger, H2O utils, metrics, XAI
│   ├── dataprep/              # Clean PySpark & Pandas ETL modules
│   ├── modelling/             # Model 1c DRF, Model 2a/2b/Baseline regressors, robustness audits
│   └── pipeline/              # Two-stage hybrid decision router & Monte Carlo benchmark
│
├── models/                    # Exported MOJO zip models (gitignored)
├── reports/                   # Generated evaluation outputs
│   ├── metrics.json           # Machine-readable output metrics
│   ├── summary.md             # Benchmark verification markdown table
│   └── figures/               # Partial Dependence Plots (PDP) and SHAP importance figures
│
├── api/                       # Production FastAPI backend
│   ├── main.py                # Endpoints: /predict, /metrics, /robustness, /codebook
│   ├── schemas.py             # Pydantic schemas
│   └── predictor.py           # MOJO inference service
│
├── web/                       # Polished React + Vite + Tailwind CSS frontend
│   ├── src/pages/             # Home, Predict, HowItWorks, Results, Robustness
│   └── src/components/        # RiskGauge, PipelineDiagram, ShapBreakdown, Navbar, Footer
│
├── docs/
│   └── EXPLAIN.md             # 5-minute presentation guide for evaluators
│
└── not/                       # Preserved historical notebooks & redundant archives (NEVER deleted)
    └── WHY_MOVED.md           # Manifest detailing why every item was moved
```

---

## 🚀 Quickstart Guide

### 1. Environment Setup
```bash
# Clone and create virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```
> **Note on Java**: H2O requires Java 8+ (64-bit). Ensure Java is installed (`java -version`).

---

### 2. Run the ML Pipeline (Single Command)
```bash
# Fast run (re-evaluates benchmarks and verifies reports in seconds)
python run_pipeline.py --skip-training

# Quick demo run on 5% subsample
python run_pipeline.py --sample 0.05

# Run a specific pipeline stage
python run_pipeline.py --stage hybrid
python run_pipeline.py --stage robustness
```

---

### 3. Launch the Web Application

#### Windows (recommended)
From the repository folder, run this in PowerShell. The script creates the Python 3.11 environment if needed, installs dependencies, starts the API in a separate window, and runs the web frontend in the current terminal:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```
Open [http://localhost:3000](http://localhost:3000). Keep both terminal windows open. Python 3.11 and Node.js are required.
The launcher installs only web/API runtime packages. For H2O model training, use the full `requirements.txt` in a separate environment; Java 8+ is also required.

#### Start the FastAPI Backend:
```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

#### Start the React Frontend:
```bash
cd web
npm install
npm run dev
```
Open your browser at: [http://localhost:3000](http://localhost:3000)

---

## 🔍 Explainability & Ethical Auditing
* **Leak-Free Guarantee**: Features that exist only after filing (judge transfers, hearings, interim orders) are strictly dropped.
* **Explainable AI (XAI)**: Includes TreeSHAP feature attribution and Partial Dependence Plots (PDP) showing marginal months added or subtracted by legal offense severity and bench tenure.
* **Fairness Auditing**: Evaluated via two perturbation experiments:
  1. *Perturbation A*: Reassignment of missing demographic codes (negligible $\Delta t = 0.025$).
  2. *Perturbation B*: 10% gender flip sensitivity testing confirming that predictions are anchored in legal acts and procedural variables, not demographic proxies.

