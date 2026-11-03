"""Unit and integration test suite for the Case Upload & Analysis upgrade.

Tests:
1. Statutory BNS <-> IPC bidirectional concordance mapper.
2. Rule-based statutory bailability engine and multi-section precedence.
3. In-memory text extraction, privacy redactor, and provenance tracking.
4. Deterministic regex legal entity extractor.
5. Structured similar cases retrieval from DDL benchmark records.
6. Full 7-section case analysis integration.
"""

import unittest
from pathlib import Path

from src.extraction.deterministic_extractor import DeterministicLegalExtractor
from src.extraction.entity_redactor import EntityRedactor
from src.extraction.fuzzy_matcher import CodebookMatcher
from src.extraction.schema import ExtractedCaseDetails
from src.extraction.verifier import verify_and_build_field, verify_verbatim_quote
from src.ingestion.text_extractor import extract_text_from_bytes, extract_text_from_string
from src.legal_knowledge.bail_rules import get_bail_assessment
from src.legal_knowledge.ipc_bns_mapper import bns_to_ipc, get_concordance_entry, ipc_to_bns
from src.retrieval.similar_cases import retrieve_similar_cases
from api.main import analyze_case, extract_case_from_text, get_sample_cases
from api.predictor import PredictorService
from api.schemas import CaseAnalysisRequest, TextExtractRequest


class TestStatutoryConcordance(unittest.TestCase):
    """Test IPC <-> BNS concordance mapping."""

    def test_ipc_to_bns_lookup(self):
        murder = ipc_to_bns("302")
        self.assertIsNotNone(murder)
        self.assertEqual(murder.bns_section, "103(1)")
        self.assertFalse(murder.bailable)
        self.assertTrue(murder.cognizable)

        theft = ipc_to_bns("379")
        self.assertIsNotNone(theft)
        self.assertEqual(theft.bns_section, "303(2)")
        self.assertTrue(theft.bailable)

        cheating = ipc_to_bns("420")
        self.assertIsNotNone(cheating)
        self.assertEqual(cheating.bns_section, "318(4)")
        self.assertFalse(cheating.bailable)

    def test_bns_to_ipc_lookup(self):
        murder = bns_to_ipc("103(1)")
        self.assertIsNotNone(murder)
        self.assertEqual(murder.ipc_section, "302")

        theft = bns_to_ipc("303(2)")
        self.assertIsNotNone(theft)
        self.assertEqual(theft.ipc_section, "379")

        bare_theft = bns_to_ipc("303")
        self.assertIsNotNone(bare_theft)
        self.assertEqual(bare_theft.ipc_section, "379")


class TestBailabilityRules(unittest.TestCase):
    """Test First Schedule CrPC/BNSS statutory bailability determinations."""

    def test_single_bailable_offence(self):
        assessment = get_bail_assessment(["379"], act="The Indian Penal Code")
        self.assertTrue(assessment.overall_bailable)
        self.assertEqual(assessment.status_label, "Bailable Offence")
        self.assertIn("Section 436 CrPC", [p["section"] for p in assessment.statutory_provisions])
        self.assertEqual(len(assessment.non_bailable_triggers), 0)

    def test_single_non_bailable_offence(self):
        assessment = get_bail_assessment(["302"], act="The Indian Penal Code")
        self.assertFalse(assessment.overall_bailable)
        self.assertEqual(assessment.status_label, "Non-Bailable Offence")
        self.assertIn("302", assessment.non_bailable_triggers)
        self.assertIn("Section 437 CrPC", [p["section"] for p in assessment.statutory_provisions])

    def test_multi_section_precedence(self):
        """Hard Rule: If ANY section is non-bailable, case is non-bailable."""
        assessment = get_bail_assessment(["379", "302", "34"], act="The Indian Penal Code")
        self.assertFalse(assessment.overall_bailable)
        self.assertEqual(assessment.status_label, "Non-Bailable Offence")
        self.assertIn("302", assessment.non_bailable_triggers)

    def test_bns_statutory_advisory(self):
        assessment = get_bail_assessment(["303(2)"], act="Bharatiya Nyaya Sanhita, 2023")
        self.assertTrue(assessment.overall_bailable)
        self.assertIn("Section 478 BNSS", [p["section"] for p in assessment.statutory_provisions])


class TestFallbackPredictionBailability(unittest.TestCase):
    """Manual API bailability codes must agree with fallback explanations."""

    def setUp(self):
        self.predictor = object.__new__(PredictorService)
        self.predictor.classifier = None

    def test_numeric_zero_is_non_bailable(self):
        result = self.predictor.predict({"section_s": "379", "bailable_ipc": 0})

        self.assertEqual(result["predicted_class"], "delayed")
        self.assertFalse(result["uncertainty"]["calibrated"])
        self.assertIn("not a statistically calibrated", result["uncertainty"]["notice"])
        bail_driver = next(
            driver for driver in result["top_features"]
            if driver["feature"] == "Non-Bailable Status & Custody Adjudication"
        )
        self.assertEqual(bail_driver["direction"], "Increases Duration")

    def test_numeric_one_is_bailable(self):
        result = self.predictor.predict({"section_s": "379", "bailable_ipc": 1})

        self.assertEqual(result["predicted_class"], "ontime")
        bail_driver = next(
            driver for driver in result["top_features"]
            if driver["feature"] == "Bailable Matter (Accused on Bond)"
        )
        self.assertEqual(bail_driver["direction"], "Reduces Duration")


class TestPrivacyAndIngestion(unittest.TestCase):
    """Test in-memory ingestion and PII redactor."""

    def test_in_memory_redaction(self):
        text = "Accused: Ramesh Kumar, phone +91 9876543210, Aadhaar 2345 6789 0123. Complainant: Sita Devi."
        redactor = EntityRedactor()
        redacted, counts = redactor.redact(text)
        self.assertNotIn("9876543210", redacted)
        self.assertNotIn("2345 6789 0123", redacted)
        self.assertIn("[REDACTED_PHONE]", redacted)
        self.assertIn("[REDACTED_AADHAAR]", redacted)
        self.assertGreater(counts["phone"], 0)
        self.assertGreater(counts["aadhaar"], 0)

    def test_extraction_provenance(self):
        doc = extract_text_from_string(
            "IN THE COURT OF SESSIONS JUDGE, PUNE\nState vs Suresh\nFIR No. 44/2023\nu/s 379 IPC"
        )
        prov = doc.find_provenance("FIR No. 44/2023")
        self.assertIsNotNone(prov)
        self.assertEqual(prov["page_num"], 1)
        self.assertEqual(prov["line_num"], 3)


class TestDeterministicLegalExtraction(unittest.TestCase):
    """Test deterministic rule-based extraction and evidence verification."""

    def setUp(self):
        self.extractor = DeterministicLegalExtractor()

    def test_legal_headers_extraction(self):
        doc = extract_text_from_string(
            "IN THE COURT OF SESSIONS JUDGE, PUNE\n"
            "State of Maharashtra vs Ramesh Kumar\n"
            "FIR No. 102/2023 PS Haveli\n"
            "Accused charged u/s 302, 34 of IPC\n"
            "Accused is in judicial custody."
        )
        res = self.extractor.extract(doc)
        self.assertIn("302", res.sections.value)
        self.assertIn("34", res.sections.value)
        self.assertEqual(res.district.value, "Pune")
        self.assertEqual(res.state.value, "Maharashtra")
        self.assertEqual(res.custody_status.value, "In Judicial Custody")
        self.assertEqual(res.case_title.value, "State of Maharashtra versus Ramesh Kumar")
        self.assertTrue(res.sections.verified)
        self.assertIsNotNone(res.sections.evidence)

    def test_empty_input_safety(self):
        """Hard Rule: Empty input must yield None/missing, zero hardcoded defaults."""
        doc = extract_text_from_string("")
        res = self.extractor.extract(doc)
        self.assertIsNone(res.case_title.value)
        self.assertIsNone(res.case_number.value)
        self.assertIsNone(res.state.value)
        self.assertIsNone(res.state_code.value)
        self.assertIsNone(res.district.value)
        self.assertIsNone(res.sections.value)
        self.assertEqual(res.case_title.confidence_level, "MISSING")
        self.assertEqual(res.state.confidence_level, "MISSING")
        self.assertEqual(res.district.confidence_level, "MISSING")
        self.assertEqual(res.sections.confidence_level, "MISSING")

    def test_sample_case1_lucknow_fixture(self):
        """Regression test on Sample Case 1: Lucknow, UP Simple Hurt."""
        fixture_path = Path(__file__).resolve().parent.parent / "sample_cases" / "case1_bailable_simple_hurt.txt"
        with open(fixture_path, "r", encoding="utf-8") as f:
            text = f.read()

        doc = extract_text_from_string(text)
        res = self.extractor.extract(doc)

        self.assertIn("Rajesh Kumar Sharma", res.case_title.value)
        self.assertIn("412 of 2016", res.case_number.value)
        self.assertEqual(res.state.value, "Uttar Pradesh")
        self.assertEqual(res.state_code.value, 13)
        self.assertEqual(res.district.value, "Lucknow")
        self.assertIn("323", res.sections.value)
        self.assertIn("506 Part I", res.sections.value)
        self.assertEqual(res.filing_year.value, 2016)
        self.assertEqual(res.custody_status.value, "Not Arrested / On Personal Bond")

    def test_sample_case2_bengaluru_fixture(self):
        """Regression test on Sample Case 2: Bengaluru, Karnataka Cheating."""
        fixture_path = Path(__file__).resolve().parent.parent / "sample_cases" / "case2_nonbailable_cheating.txt"
        with open(fixture_path, "r", encoding="utf-8") as f:
            text = f.read()

        doc = extract_text_from_string(text)
        res = self.extractor.extract(doc)

        self.assertIn("Suresh Gowda", res.case_title.value)
        self.assertIn("890 of 2019", res.case_number.value)
        self.assertEqual(res.state.value, "Karnataka")
        self.assertEqual(res.state_code.value, 3)
        self.assertEqual(res.district.value, "Bengaluru")
        self.assertIn("420", res.sections.value)
        self.assertIn("406", res.sections.value)
        self.assertIn("34", res.sections.value)
        self.assertEqual(res.filing_year.value, 2019)
        self.assertEqual(res.custody_status.value, "In Judicial Custody")

    def test_sample_case3_indore_fixture(self):
        """Regression test on Sample Case 3: Indore, MP Sessions Grievous Hurt."""
        fixture_path = Path(__file__).resolve().parent.parent / "sample_cases" / "case3_mixed_multi_section.txt"
        with open(fixture_path, "r", encoding="utf-8") as f:
            text = f.read()

        doc = extract_text_from_string(text)
        res = self.extractor.extract(doc)

        self.assertIn("Vikram Singh", res.case_title.value)
        self.assertIn("205 of 2018", res.case_number.value)
        self.assertEqual(res.state.value, "Madhya Pradesh")
        self.assertEqual(res.state_code.value, 23)
        self.assertEqual(res.district.value, "Indore")
        self.assertIn("341", res.sections.value)
        self.assertIn("323", res.sections.value)
        self.assertIn("326", res.sections.value)
        self.assertIn("34", res.sections.value)
        self.assertEqual(res.case_type.value, "Sessions Case")
        self.assertEqual(res.filing_year.value, 2018)

    def test_anti_hallucination_verifier(self):
        """Verification gate must reject values that do not appear in source text."""
        source_text = "Court of JMFC, Lucknow, Uttar Pradesh. Case 100/2020."

        # Truthful snippet
        valid_good, start_g, end_g = verify_verbatim_quote("Court of JMFC, Lucknow", source_text)
        self.assertTrue(valid_good)
        self.assertGreaterEqual(start_g, 0)

        # Hallucinated snippet
        valid_bad, start_b, end_b = verify_verbatim_quote("Court of Sessions Judge, Pune, Maharashtra", source_text)
        self.assertFalse(valid_bad)

        # Verify field builder rejects hallucination
        field_hallucinated = verify_and_build_field(
            value="Pune",
            evidence_snippet="Court of Sessions Judge, Pune, Maharashtra",
            source_text=source_text,
            must_contain_literal=True,
        )
        self.assertIsNone(field_hallucinated.value)
        self.assertEqual(field_hallucinated.confidence_level, "MISSING")
        self.assertFalse(field_hallucinated.verified)


class TestSimilarCasesRetrieval(unittest.TestCase):
    """Test structured past cases retrieval with 3-tier fallback."""

    def test_retrieve_cases(self):
        summary = retrieve_similar_cases(
            section="379",
            case_type="Criminal Case",
            state_name="Maharashtra",
            district_name="Pune",
            state_code=1,
            dist_code=1,
        )
        self.assertGreater(summary.total_matches, 0)
        self.assertGreater(len(summary.sample_cases), 0)
        self.assertIn("DDL", summary.sample_cases[0].case_id)
        self.assertTrue(hasattr(summary, "data_note"))


class TestFullAnalysisEndpoint(unittest.TestCase):
    """Integration test of full 7-section case analysis."""

    def test_sample_case_analysis(self):
        samples = get_sample_cases()
        self.assertEqual(len(samples), 3)

        sample1 = samples[0]  # Simple theft (bailable)
        req = CaseAnalysisRequest(**sample1)
        resp = analyze_case(req)

        # Verify all 7 sections exist
        self.assertIsNotNone(resp.glance)
        self.assertIsNotNone(resp.duration_prediction)
        self.assertIsNotNone(resp.delay_drivers)
        self.assertIsNotNone(resp.similar_cases)
        self.assertIsNotNone(resp.bail_assessment)
        self.assertIsNotNone(resp.procedural_roadmap)
        self.assertIsNotNone(resp.integrity_disclosure)

        # Check bailable outcome
        self.assertTrue(resp.bail_assessment["overall_bailable"])
        self.assertEqual(resp.glance["case_title"], sample1["case_title"])
        self.assertIn("Model", resp.duration_prediction["routed_regressor"])


if __name__ == "__main__":
    unittest.main()

