# DDL e-Courts Key Files & Codebook Dictionaries

This directory contains the official Development Data Lab (DDL) e-Courts codebook dictionaries for Indian subordinate courts:

| File | Description | Records / Size |
| :--- | :--- | :--- |
| `cases_state_key.csv` | State codes to official state names (32 jurisdictions) | 11 KB |
| `cases_district_key.csv` | District codes mapped by state code | 46 KB |
| `cases_court_key.csv` | Court complex and court number mapping | 4.6 MB |
| `type_name_key.csv` | Standardized case types (Criminal, Sessions, Appeal, etc.) | 1.8 MB |
| `act_key.csv` | Indian Acts dictionary (IPC 1860, CrPC, Special Acts) | 1.4 MB |
| `section_key.csv` | Statutory section codes and descriptions | 69.9 MB |
| `disp_name_key.csv` | Case disposition and outcome classifications | 12 KB |
| `purpose_name_key.csv` | Hearing purpose classification codes | 2.7 MB |
| `judge_case_merge_key.csv.gz` | Case-to-Judge identifier linkage dataset (compressed) | 42.3 MB |

> **Note on `judge_case_merge_key.csv.gz`**:
> To comply with GitHub's 100 MB single-file limit, `judge_case_merge_key` is stored compressed (42 MB compressed vs. 488 MB raw).
> To decompress if needed:
> ```bash
> gzip -d -k judge_case_merge_key.csv.gz
> ```
