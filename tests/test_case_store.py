"""Tests for local account sessions and case-outcome evaluation storage."""

import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from api import case_store


class TestCaseStore(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = case_store.DB_PATH
        case_store.DB_PATH = Path(self.temp_dir.name) / "case_registry.sqlite3"
        case_store.initialize_store()

    def tearDown(self):
        case_store.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_registration_login_and_token_session(self):
        registration = case_store.register("Analyst@example.com", "correct-horse-battery")
        self.assertEqual(registration["user"]["email"], "analyst@example.com")
        user = case_store.get_user_for_token(registration["access_token"])
        self.assertEqual(user["id"], registration["user"]["id"])

        login = case_store.login("ANALYST@example.com", "correct-horse-battery")
        self.assertEqual(login["user"]["email"], "analyst@example.com")

        case_store.logout(registration["access_token"])
        with self.assertRaises(HTTPException) as error:
            case_store.get_user_for_token(registration["access_token"])
        self.assertEqual(error.exception.status_code, 401)

    def test_password_policy_and_duplicate_email(self):
        with self.assertRaises(HTTPException) as weak_password:
            case_store.register("user@example.com", "short")
        self.assertEqual(weak_password.exception.status_code, 422)

        case_store.register("user@example.com", "long-enough-password")
        with self.assertRaises(HTTPException) as duplicate:
            case_store.register("USER@example.com", "another-long-password")
        self.assertEqual(duplicate.exception.status_code, 409)

    def test_saved_case_outcome_error_and_owner_isolation(self):
        owner = case_store.register("owner@example.com", "owner-password-long")
        other = case_store.register("other@example.com", "other-password-long")
        owner_id = owner["user"]["id"]
        other_id = other["user"]["id"]
        saved = case_store.save_case(owner_id, {
            "case_details": {
                "case_title": "Demo case",
                "case_number": "D-123",
                "state": "Maharashtra",
                "district": "Pune",
                "sections": ["379"],
                "filing_date": "2020-01-01",
            },
            "forecast": {
                "expected_duration_months": 20.0,
                "duration_range_months": [12.0, 30.0],
                "predicted_class": "ontime",
                "delay_risk_pct": 40.0,
                "source": "demo",
            },
            "prediction_mode": "research_benchmark_fallback",
        })

        self.assertEqual(saved["forecast_low"], 12.0)
        self.assertEqual(saved["forecast_high"], 30.0)
        self.assertFalse(saved["has_outcome"])
        with self.assertRaises(HTTPException) as isolated:
            case_store.get_case(other_id, saved["id"])
        self.assertEqual(isolated.exception.status_code, 404)

        completed = case_store.update_outcome(owner_id, saved["id"], {
            "actual_duration_months": 25.0,
            "actual_disposition_date": "2022-02-01",
            "actual_disposition": "Disposed",
            "outcome_note": None,
        })
        self.assertTrue(completed["has_outcome"])
        self.assertEqual(completed["duration_error_months"], -5.0)
        self.assertEqual(completed["absolute_error_months"], 5.0)

    def test_evaluation_metrics_use_completed_cases_and_separate_modes(self):
        records = [
            {
                "has_outcome": True,
                "forecast_months": 20.0,
                "actual_duration_months": 25.0,
                "duration_error_months": -5.0,
                "predicted_class": "ontime",
                "prediction_mode": "research_benchmark_fallback",
            },
            {
                "has_outcome": True,
                "forecast_months": 30.0,
                "actual_duration_months": 20.0,
                "duration_error_months": 10.0,
                "predicted_class": "delayed",
                "prediction_mode": "trained_local_model",
            },
            {
                "has_outcome": True,
                "forecast_months": 24.0,
                "actual_duration_months": 24.0,
                "duration_error_months": 0.0,
                "predicted_class": "ontime",
                "prediction_mode": "trained_local_model",
            },
            {"has_outcome": False, "prediction_mode": "research_benchmark_fallback"},
        ]

        summary = case_store.summarize_evaluation(records)

        self.assertEqual(summary["completed_outcomes"], 3)
        self.assertEqual(summary["pending_outcomes"], 1)
        self.assertEqual(summary["mae_months"], 5.0)
        self.assertEqual(summary["rmse_months"], 6.45)
        self.assertEqual(summary["mean_error_months"], 1.67)
        self.assertEqual(summary["classification_accuracy_pct"], 33.33)
        self.assertEqual(summary["confusion_matrix"]["actual_delayed_predicted_ontime"], 1)
        self.assertEqual(summary["confusion_matrix"]["actual_ontime_predicted_delayed"], 1)
        self.assertEqual(summary["by_prediction_mode"]["research_benchmark_fallback"]["case_count"], 1)
        self.assertEqual(summary["by_prediction_mode"]["trained_local_model"]["case_count"], 2)


if __name__ == "__main__":
    unittest.main()
