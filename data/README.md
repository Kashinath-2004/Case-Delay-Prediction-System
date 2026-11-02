# Justice AI Data Architecture

This folder contains the datasets, codebook lookup tables, and directory structures for the Indian Lower Courts case delay prediction system.

## Directory Structure

```text
data/
├── processed/              # Processed ML training & evaluation feature matrices (.gitkeep)
├── raw/                    # Raw DDL e-Courts benchmarks and reference datasets
│   ├── DDL_LICENSE.txt     # Open data terms of use (Development Data Lab)
│   ├── judges_clean.csv    # Cleaned judicial tenure and bench records (8.3 MB)
│   └── keys/               # Codebook mapping tables for states, districts, acts, and sections
│       ├── act_key.csv
│       ├── cases_court_key.csv
│       ├── cases_district_key.csv
│       ├── cases_state_key.csv
│       ├── disp_name_key.csv
│       ├── judge_case_merge_key.csv.gz
│       ├── purpose_name_key.csv
│       ├── section_key.csv
│       ├── type_name_key.csv
│       └── README.md
└── reference_results/      # Reference ablation and Monte Carlo benchmark results (.gitkeep)
```

## Source Citation
Trained and evaluated on the Development Data Lab (DDL) e-Courts dataset covering criminal filings across Indian subordinate courts (2010–2018).
Dataset DOI: [10.5281/zenodo.17421604](https://doi.org/10.5281/zenodo.17421604).
