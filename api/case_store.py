"""Local SQLite account and case-evaluation storage for the demo application."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.getenv("JUSTICE_AI_DB_PATH", ROOT / "data" / "case_registry.sqlite3"))
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14


@contextmanager
def _connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_store() -> None:
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS case_records (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                case_title TEXT NOT NULL,
                case_number TEXT,
                state TEXT,
                district TEXT,
                sections_json TEXT NOT NULL,
                filing_date TEXT,
                forecast_months REAL,
                forecast_low REAL,
                forecast_high REAL,
                predicted_class TEXT,
                delay_risk_pct REAL,
                prediction_mode TEXT NOT NULL,
                prediction_source TEXT,
                case_details_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                actual_duration_months REAL,
                actual_disposition_date TEXT,
                actual_disposition TEXT,
                outcome_note TEXT,
                outcome_updated_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_case_records_user_created
                ON case_records(user_id, created_at DESC);
            """
        )


def _password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)


def register(email: str, password: str) -> dict[str, Any]:
    clean_email = email.strip().lower()
    if len(clean_email) > 254 or "@" not in clean_email:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if len(password) < 10 or len(password) > 256:
        raise HTTPException(status_code=422, detail="Password must be between 10 and 256 characters.")

    salt = secrets.token_bytes(16)
    password_hash = _password_digest(password, salt)
    now = int(time.time())
    try:
        with _connect() as connection:
            cursor = connection.execute(
                "INSERT INTO users(email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (clean_email, salt, password_hash, now),
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc
    return _new_session(user_id, clean_email)


def login(email: str, password: str) -> dict[str, Any]:
    clean_email = email.strip().lower()
    with _connect() as connection:
        user = connection.execute(
            "SELECT id, email, password_salt, password_hash FROM users WHERE email = ?", (clean_email,)
        ).fetchone()
    if user is None or not hmac.compare_digest(_password_digest(password, user["password_salt"]), user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return _new_session(user["id"], user["email"])


def _new_session(user_id: int, email: str) -> dict[str, Any]:
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    with _connect() as connection:
        connection.execute(
            "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (hashlib.sha256(token.encode()).hexdigest(), user_id, expires_at),
        )
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at, "user": {"id": user_id, "email": email}}


def get_user_for_token(token: str | None) -> dict[str, Any]:
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to access your case register.")
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with _connect() as connection:
        session = connection.execute(
            "SELECT users.id, users.email, sessions.expires_at FROM sessions "
            "JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?",
            (token_hash,),
        ).fetchone()
        if session is None or session["expires_at"] < int(time.time()):
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    return {"id": session["id"], "email": session["email"]}


def logout(token: str | None) -> None:
    if token:
        with _connect() as connection:
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))


def save_case(user_id: int, record: dict[str, Any]) -> dict[str, Any]:
    case_id = secrets.token_urlsafe(16)
    details = record["case_details"]
    forecast = record["forecast"]
    now = int(time.time())
    with _connect() as connection:
        connection.execute(
            """INSERT INTO case_records(
                id, user_id, case_title, case_number, state, district, sections_json,
                filing_date, forecast_months, forecast_low, forecast_high, predicted_class,
                delay_risk_pct, prediction_mode, prediction_source, case_details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                case_id, user_id, details.get("case_title") or "Untitled case", details.get("case_number"),
                details.get("state"), details.get("district"), json.dumps(details.get("sections") or []),
                details.get("filing_date"), forecast.get("expected_duration_months"),
                *(forecast.get("duration_range_months") or [None, None]), forecast.get("predicted_class"),
                forecast.get("delay_risk_pct"), record.get("prediction_mode", "unknown"),
                forecast.get("source"), json.dumps(details, ensure_ascii=False), now,
            ),
        )
    return get_case(user_id, case_id)


def _serialize_case(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["sections"] = json.loads(item.pop("sections_json"))
    item["case_details"] = json.loads(item.pop("case_details_json"))
    item["has_outcome"] = item["actual_duration_months"] is not None
    if item["actual_duration_months"] is not None and item["forecast_months"] is not None:
        item["duration_error_months"] = round(item["forecast_months"] - item["actual_duration_months"], 2)
        item["absolute_error_months"] = round(abs(item["duration_error_months"]), 2)
    else:
        item["duration_error_months"] = None
        item["absolute_error_months"] = None
    return item


def list_cases(user_id: int) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            "SELECT * FROM case_records WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    return [_serialize_case(row) for row in rows]


def get_case(user_id: int, case_id: str) -> dict[str, Any]:
    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM case_records WHERE user_id = ? AND id = ?", (user_id, case_id)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Case record not found.")
    return _serialize_case(row)


def update_outcome(user_id: int, case_id: str, outcome: dict[str, Any]) -> dict[str, Any]:
    with _connect() as connection:
        cursor = connection.execute(
            """UPDATE case_records SET actual_duration_months = ?, actual_disposition_date = ?,
                actual_disposition = ?, outcome_note = ?, outcome_updated_at = ?
                WHERE user_id = ? AND id = ?""",
            (
                outcome["actual_duration_months"], outcome.get("actual_disposition_date"),
                outcome.get("actual_disposition"), outcome.get("outcome_note"), int(time.time()),
                user_id, case_id,
            ),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Case record not found.")
    return get_case(user_id, case_id)


def delete_case(user_id: int, case_id: str) -> None:
    with _connect() as connection:
        cursor = connection.execute("DELETE FROM case_records WHERE user_id = ? AND id = ?", (user_id, case_id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Case record not found.")


def summarize_evaluation(records: list[dict[str, Any]], threshold_months: float = 24.0) -> dict[str, Any]:
    """Summarize only records with an actual outcome; never treat fallback targets as test labels."""
    completed = [
        record for record in records
        if record.get("has_outcome") and record.get("forecast_months") is not None
    ]
    errors = [record["duration_error_months"] for record in completed]
    classified = [
        record for record in completed
        if record.get("predicted_class") in {"ontime", "delayed"}
    ]
    confusion = {
        "actual_ontime_predicted_ontime": 0,
        "actual_ontime_predicted_delayed": 0,
        "actual_delayed_predicted_ontime": 0,
        "actual_delayed_predicted_delayed": 0,
    }
    for record in classified:
        actual = "ontime" if record["actual_duration_months"] <= threshold_months else "delayed"
        predicted = record["predicted_class"]
        confusion[f"actual_{actual}_predicted_{predicted}"] += 1

    modes: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        if record.get("has_outcome"):
            mode = record.get("prediction_mode") or "unknown"
            modes.setdefault(mode, []).append(record)

    return {
        "total_cases": len(records),
        "completed_outcomes": len(completed),
        "pending_outcomes": len(records) - sum(bool(record.get("has_outcome")) for record in records),
        "mae_months": round(sum(abs(error) for error in errors) / len(errors), 2) if errors else None,
        "rmse_months": round((sum(error * error for error in errors) / len(errors)) ** 0.5, 2) if errors else None,
        "mean_error_months": round(sum(errors) / len(errors), 2) if errors else None,
        "classification_cases": len(classified),
        "classification_accuracy_pct": round(
            100 * sum(
                (record["actual_duration_months"] <= threshold_months) == (record["predicted_class"] == "ontime")
                for record in classified
            ) / len(classified), 2
        ) if classified else None,
        "threshold_months": threshold_months,
        "confusion_matrix": confusion,
        "by_prediction_mode": {
            mode: {
                "case_count": len(mode_records),
                "mae_months": round(
                    sum(abs(record["duration_error_months"]) for record in mode_records) / len(mode_records), 2
                ),
                "rmse_months": round(
                    (sum(record["duration_error_months"] ** 2 for record in mode_records) / len(mode_records)) ** 0.5, 2
                ),
            }
            for mode, mode_records in sorted(modes.items())
        },
        "note": (
            "Metrics use only saved cases with user-entered actual durations; they are observational, "
            "not a benchmark test set. Results are grouped by prediction mode."
        ),
    }
