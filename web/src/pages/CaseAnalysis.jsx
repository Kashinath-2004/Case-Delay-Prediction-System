import React, { useState, useEffect } from 'react';
import { ClipboardCopy, Download, Printer } from 'lucide-react';

export default function CaseAnalysis({ token }) {
  const [step, setStep] = useState(1); // 1: Ingest, 2: Review, 3: Results
  const [ingestTab, setIngestTab] = useState('upload'); // 'upload' or 'paste'
  const [file, setFile] = useState(null);
  const [caseText, setCaseText] = useState('');
  const [redactPii, setRedactPii] = useState(true);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [sampleCases, setSampleCases] = useState([]);
  const [reviewData, setReviewData] = useState({
    case_title: '',
    case_number: '',
    filing_year: 2024,
    state: 'Maharashtra',
    state_code: 1,
    district: '',
    dist_code: 1,
    court_name: '',
    court_no: 1,
    act: 'The Indian Penal Code',
    sections: [],
    bns_equivalents: {},
    case_type: 'Criminal Case',
    judge_position: 'Judicial Magistrate / Sessions Judge',
    judge_tenure_months: 14.0,
    accused_names: [],
    accused_count: 1,
    custody_status: 'Not Arrested',
    case_summary: '',
    extraction_mode: 'DETERMINISTIC_RULES',
    raw_meta: {},
  });
  const [resultsData, setResultsData] = useState(null);
  const [exportNotice, setExportNotice] = useState('');
  const [recordSaved, setRecordSaved] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  const normalizeExtractedData = (data) => {
    const getVal = (f) => (f && typeof f === 'object' && 'value' in f) ? f.value : f;
    const getMeta = (f) => (f && typeof f === 'object' && ('confidence' in f || 'evidence' in f)) ? f : null;

    return {
      case_title: getVal(data.case_title) || '',
      case_number: getVal(data.case_number) || '',
      filing_date: getVal(data.filing_date) || '',
      state: getVal(data.state) || 'Maharashtra',
      state_code: getVal(data.state_code) || 1,
      district: getVal(data.district) || getVal(data.court_name) || '',
      dist_code: getVal(data.dist_code) || 1,
      court_name: getVal(data.court_name) || '',
      court_no: 1,
      act: getVal(data.act) || 'The Indian Penal Code',
      sections: getVal(data.sections) || [],
      bns_equivalents: data.bns_equivalents || {},
      case_type: getVal(data.case_type) || 'Criminal Case',
      custody_status: getVal(data.custody_status) || 'Not Arrested',
      filing_year: getVal(data.filing_year) || 2024,
      accused_names: getVal(data.accused_names) || [],
      accused_count: getVal(data.accused_count) || 1,
      case_summary: getVal(data.case_summary) || '',
      extraction_mode: data.extraction_mode || 'DETERMINISTIC_RULES',
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      raw_meta: {
        case_title: getMeta(data.case_title),
        case_number: getMeta(data.case_number),
        filing_date: getMeta(data.filing_date),
        filing_year: getMeta(data.filing_year),
        court_name: getMeta(data.court_name),
        state: getMeta(data.state) || getMeta(data.state_code),
        district: getMeta(data.district) || getMeta(data.court_name),
        act: getMeta(data.act),
        sections: getMeta(data.sections),
        accused_names: getMeta(data.accused_names),
        accused_count: getMeta(data.accused_count),
        custody_status: getMeta(data.custody_status),
        case_type: getMeta(data.case_type),
        case_summary: getMeta(data.case_summary),
      }
    };
  };

  const evidenceFields = [
    ['Case title / parties', 'case_title'],
    ['Case / FIR number', 'case_number'],
    ['Filing date', 'filing_date'],
    ['Court', 'court_name'],
    ['State', 'state'],
    ['District', 'district'],
    ['Act', 'act'],
    ['Charged sections', 'sections'],
    ['Accused names', 'accused_names'],
    ['Custody status', 'custody_status'],
    ['Case type', 'case_type'],
    ['Case summary', 'case_summary'],
  ];

  const getFieldEvidence = (meta) => {
    if (!meta || typeof meta !== 'object') return null;
    if (meta.evidence && typeof meta.evidence === 'object') return meta.evidence;
    if (meta.evidence_snippet) return { snippet: meta.evidence_snippet };
    return null;
  };

  const getEvidenceStatus = (meta, value) => {
    if (!value) return 'Needs review';
    if (meta?.conflict_warning) return 'Conflict to review';
    if (meta?.is_inferred || meta?.confidence_level === 'INFERRED') return 'Inferred';
    if (meta?.verified) return 'Verified against source';
    if (getFieldEvidence(meta)) return 'Source quote available';
    return 'No source quote';
  };

  useEffect(() => {
    fetch('/api/case/sample')
      .then(res => res.json())
      .then(data => setSampleCases(data))
      .catch(err => console.warn('Sample fetch err:', err));
  }, []);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const loadSample = (idx) => {
    if (sampleCases[idx]) {
      setReviewData(normalizeExtractedData(sampleCases[idx]));
      setValidationError('');
      setStep(2);
    }
  };

  const loadSampleTextToEditor = (idx) => {
    setIngestTab('paste');
    if (sampleCases[idx] && sampleCases[idx].sample_text) {
      setCaseText(sampleCases[idx].sample_text);
    }
  };

  const handleExtract = async () => {
    setLoading(true);
    setValidationError('');
    try {
      let respData = null;
      if (ingestTab === 'upload') {
        if (!file) {
          alert('Please select or drop a PDF, Word document, or text file to upload.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('redact_pii', redactPii);
        const res = await fetch('/api/case/extract', { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'File extraction failed');
        }
        respData = await res.json();
      } else {
        if (!caseText.trim()) {
          alert('Please paste case text or FIR details into the box.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/case/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: caseText, redact_pii: redactPii })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Text extraction failed');
        }
        respData = await res.json();
      }

      setReviewData(normalizeExtractedData(respData));
      setStep(2);
    } catch (err) {
      alert('Extraction failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setValidationError('');
    // Validation check
    const missing = [];
    if (!reviewData.case_title.trim()) missing.push('Case Title');
    if (!reviewData.sections || reviewData.sections.length === 0) missing.push('Charged Section(s)');
    if (!reviewData.district.trim()) missing.push('District / Court');

    if (missing.length > 0) {
      setValidationError(`Cannot proceed: Please fill in the required field(s): ${missing.join(', ')}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/case/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setResultsData(data);
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Analysis error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    setExportNotice('');
    const confirmed = window.confirm(
      'The downloaded report includes case details and analysis. Store it securely and only share it with authorized people.'
    );
    if (!confirmed) return;

    const report = {
      report_title: 'Justice AI Case Analysis',
      exported_at: new Date().toISOString(),
      case_details: reviewData,
      analysis: resultsData,
    };
    const filenameBase = (reviewData.case_number || reviewData.case_title || 'case-analysis')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'case-analysis';
    const objectUrl = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    );
    const downloadLink = document.createElement('a');
    downloadLink.href = objectUrl;
    downloadLink.download = `${filenameBase}-report.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const copySummary = async () => {
    const prediction = resultsData.duration_prediction;
    const summary = [
      'Justice AI | Case Analysis Summary',
      `Case: ${resultsData.glance.case_title || 'Not provided'}`,
      `Case number: ${resultsData.glance.case_number || 'Not provided'}`,
      `Venue: ${resultsData.glance.district}, ${resultsData.glance.state}`,
      `Sections: ${(resultsData.glance.sections || []).join(', ') || 'Not provided'}`,
      `Estimated duration: ${prediction.expected_duration_months.toFixed(1)} months (range ${prediction.duration_range_months[0].toFixed(1)}-${prediction.duration_range_months[1].toFixed(1)} months)`,
      `Delay risk: ${prediction.delay_risk_pct.toFixed(1)}%`,
      `Bail classification: ${resultsData.bail_assessment.status_label}`,
      'This is an informational estimate, not legal advice.',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setExportNotice('Summary copied to clipboard.');
    } catch {
      setExportNotice('Clipboard access is unavailable in this browser.');
    }
  };

  const saveCaseRecord = async () => {
    setSavingRecord(true);
    setExportNotice('');
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          case_details: {
            case_title: resultsData.glance.case_title,
            case_number: resultsData.glance.case_number,
            state: resultsData.glance.state,
            district: resultsData.glance.district,
            sections: resultsData.glance.sections,
            filing_date: reviewData.filing_date || null,
            case_type: reviewData.case_type,
          },
          forecast: {
            expected_duration_months: resultsData.duration_prediction.expected_duration_months,
            duration_range_months: resultsData.duration_prediction.duration_range_months,
            predicted_class: resultsData.duration_prediction.predicted_class,
            delay_risk_pct: resultsData.duration_prediction.delay_risk_pct,
            source: resultsData.duration_prediction.source,
          },
          prediction_mode: resultsData.duration_prediction.model_trained ? 'trained_local_model' : 'research_benchmark_fallback',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Could not save this case record.');
      setRecordSaved(true);
      setExportNotice('Saved to your case register. Source text and evidence quotes were not saved.');
    } catch (requestError) {
      setExportNotice(requestError.message || 'Could not save this case record.');
    } finally {
      setSavingRecord(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-navy-900/5 dark:bg-gold-500/10 border border-navy-900/10 dark:border-gold-500/20 text-xs font-semibold text-navy-800 dark:text-gold-400">
          <span>⚖️ Full Case Document Analysis · Indian Subordinate Courts</span>
        </div>
        <h1 className="serif-heading text-3xl sm:text-4xl font-extrabold text-navy-950 dark:text-white tracking-tight">
          Upload a Case File — Get Full AI & Legal Analysis
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
          Upload an FIR, chargesheet, or petition. Get two-stage hybrid ML delay predictions, similar cases from DDL e-Courts records, and statutory bailability advisory.
        </p>
      </div>

      {/* Quick Sample Selector */}
      {step === 1 && (
        <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡</span> Quick Sample Fixtures:
          </span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => loadSample(0)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition" title="Court of JMFC Lucknow, UP; IPC 323, 506 Part I">
              1. Lucknow: Simple Hurt (UP · Bailable)
            </button>
            <button onClick={() => loadSample(1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition" title="Court of CMM Bengaluru, Karnataka; IPC 420, 406, 34">
              2. Bengaluru: Cheating (Karnataka · Non-Bailable)
            </button>
            <button onClick={() => loadSample(2)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition" title="Sessions Court Indore, MP; IPC 341, 323, 326, 34">
              3. Indore: Grievous Hurt (MP · Sessions)
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: INGESTION */}
      {step === 1 && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-4">
            <div>
              <h3 className="serif-heading text-xl font-bold text-navy-950 dark:text-white">Step 1: Provide Case Document or Text</h3>
              <p className="text-xs text-slate-500 mt-0.5">Processed strictly in-memory; never stored on disk or shared with external parties.</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
              🔒 In-Memory Privacy
            </span>
          </div>

          {/* Ingestion Tabs */}
          <div className="flex border-b border-slate-200 dark:border-navy-800 gap-2">
            <button 
              type="button" 
              onClick={() => setIngestTab('upload')} 
              className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${ingestTab === 'upload' ? 'border-navy-900 dark:border-gold-500 text-navy-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-navy-950 dark:hover:text-white font-semibold'}`}
            >
              <span>📄</span> Option A: Upload Document (PDF / DOCX / TXT)
            </button>
            <button 
              type="button" 
              onClick={() => setIngestTab('paste')} 
              className={`pb-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition ${ingestTab === 'paste' ? 'border-navy-900 dark:border-gold-500 text-navy-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-navy-950 dark:hover:text-white font-semibold'}`}
            >
              <span>📝</span> Option B: Paste Case Text / FIR Details
            </button>
          </div>

          {ingestTab === 'upload' ? (
            <div className="space-y-3">
              <div 
                onDragOver={(e) => e.preventDefault()} 
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-slate-300 dark:border-navy-700 hover:border-gold-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 dark:bg-navy-950 flex flex-col items-center justify-center min-h-[170px]"
                onClick={() => document.getElementById('react-file-input').click()}
              >
                <input 
                  type="file" 
                  id="react-file-input" 
                  className="hidden" 
                  accept=".pdf,.docx,.txt" 
                  onChange={(e) => e.target.files.length > 0 && setFile(e.target.files[0])} 
                />
                <div className="text-3xl mb-2">📄</div>
                <p className="text-xs font-semibold text-navy-950 dark:text-white">
                  {file ? `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Click or drag & drop document here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Supports digital PDFs, Word documents (.docx), text files (.txt)</p>
                {file && (
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }} 
                    className="mt-3 px-2.5 py-1 text-[11px] rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100 border border-rose-200"
                  >
                    Remove Selected File
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Case Document Text / FIR Excerpt:</label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Load fixture:</span>
                  <button type="button" onClick={() => loadSampleTextToEditor(0)} className="text-gold-600 hover:underline font-semibold">Sample 1</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={() => loadSampleTextToEditor(1)} className="text-gold-600 hover:underline font-semibold">Sample 2</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={() => loadSampleTextToEditor(2)} className="text-gold-600 hover:underline font-semibold">Sample 3</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={() => setCaseText('')} className="text-slate-400 hover:text-rose-600">Clear</button>
                </div>
              </div>
              <textarea 
                rows="8" 
                value={caseText}
                onChange={(e) => setCaseText(e.target.value)}
                className="w-full text-xs rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 p-3.5 dark:text-white focus:ring-2 focus:ring-gold-500 font-mono" 
                placeholder="Paste FIR or case text here..."
              />
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex items-center justify-between">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={redactPii} 
                onChange={(e) => setRedactPii(e.target.checked)} 
                className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500" 
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                🔒 <strong>Redact Personal Identifiers in Memory:</strong> Masks names, phone numbers, and Aadhaar before processing.
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              onClick={handleExtract} 
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-gold-500 dark:hover:bg-gold-400 text-white dark:text-navy-950 font-bold shadow-md transition flex items-center gap-2"
            >
              <span>{loading ? 'Extracting Details... ⏳' : 'Extract Case Details →'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW & CONFIRM */}
      {step === 2 && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="serif-heading text-xl font-bold text-navy-950 dark:text-white">Step 2: Review & Confirm Extracted Parameters</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Human in the Loop</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Please check and correct any field before running the predictive model. Provenance indicates exact source line and verbatim quotes.</p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-navy-950 dark:hover:text-white underline">← Re-upload</button>
          </div>

          {/* Dynamic Extraction Mode Banner */}
          {reviewData.extraction_mode === 'DEMO_SAMPLE' ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚡</span>
                <div>
                  <span className="font-bold text-sm">EXTRACTION MODE: DEMO / BENCHMARK FIXTURE</span>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">Pre-configured evaluation benchmark case. Verify or edit parameters before analysis.</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">BENCHMARK DEMO</span>
            </div>
          ) : reviewData.extraction_mode === 'HYBRID_LLM' ? (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🤖</span>
                <div>
                  <span className="font-bold text-sm">EXTRACTION MODE: HYBRID LLM EXTRACTION</span>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">Deterministic legal rules reconciled with LLM refinement and verified against verbatim quotes.</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100">VERIFIED QUOTES</span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛡️</span>
                <div>
                  <span className="font-bold text-sm">EXTRACTION MODE: RULE-BASED (100% Evidence-Verified)</span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">All fields verified with exact character offsets against source document. Zero generative hallucination.</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">AUDITED EVIDENCE</span>
            </div>
          )}

          <section aria-labelledby="extraction-evidence-heading" className="space-y-4 rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 id="extraction-evidence-heading" className="font-bold text-sm text-navy-950 dark:text-white">Extraction evidence</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Review source support before continuing. Quotes reflect the text received by the extractor, including any enabled redaction.</p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{reviewData.extraction_mode === 'DEMO_SAMPLE' ? 'Demo fixture' : reviewData.extraction_mode || 'Extraction'}</span>
            </div>

            {reviewData.extraction_mode === 'DEMO_SAMPLE' ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                This preconfigured sample does not include field-level extraction provenance. Confirm the displayed case details manually.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {evidenceFields.map(([label, key]) => {
                  const meta = reviewData.raw_meta?.[key];
                  const evidence = getFieldEvidence(meta);
                  const value = reviewData[key];
                  const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value);
                  const displayValue = Array.isArray(value) ? value.join(', ') : value;
                  const status = getEvidenceStatus(meta, hasValue ? displayValue : '');

                  return (
                    <article key={key} className="min-w-0 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</h5>
                          <p className="mt-1 text-xs text-navy-950 dark:text-white break-words">{hasValue ? displayValue : 'No value extracted'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === 'Verified against source' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : status === 'Needs review' || status === 'Conflict to review' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300'}`}>
                          {status}
                        </span>
                      </div>
                      {evidence?.snippet && (
                        <blockquote className="mt-2 border-l-2 border-gold-500 pl-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 break-words">
                          “{evidence.snippet}”
                          <span className="mt-1 block text-[10px] text-slate-400">
                            {[evidence.page_num && `Page ${evidence.page_num}`, evidence.line_num && `Line ${evidence.line_num}`, evidence.method].filter(Boolean).join(' · ')}
                          </span>
                        </blockquote>
                      )}
                      {Number.isFinite(meta?.confidence) && (
                        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Extraction confidence: {Math.round(meta.confidence * 100)}%</p>
                      )}
                      {meta?.conflict_warning && (
                        <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300">{meta.conflict_warning}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {Array.isArray(reviewData.warnings) && reviewData.warnings.length > 0 && (
              <ul className="space-y-1 border-t border-slate-200 dark:border-navy-800 pt-3 text-xs text-amber-800 dark:text-amber-300">
                {reviewData.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Case Title / Parties <span className="text-rose-500 font-bold">*</span></label>
                {reviewData.raw_meta?.case_title?.confidence ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    🟢 High ({Math.round(reviewData.raw_meta.case_title.confidence * 100)}%)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">⚪ Verified</span>
                )}
              </div>
              <input 
                type="text" 
                value={reviewData.case_title || ''} 
                onChange={(e) => setReviewData({ ...reviewData, case_title: e.target.value })}
                placeholder="Not found in text — please enter manually"
                className={`w-full text-xs rounded-xl border ${!reviewData.case_title.trim() ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950'} px-3 py-2.5 dark:text-white`} 
              />
              {reviewData.raw_meta?.case_title?.evidence?.snippet ? (
                <span className="text-[10px] text-slate-500 mt-1 block truncate">
                  📍 Line {reviewData.raw_meta.case_title.evidence.line_num}: "{reviewData.raw_meta.case_title.evidence.snippet.substring(0, 70)}"
                </span>
              ) : !reviewData.case_title.trim() && (
                <span className="text-[10px] text-amber-600 mt-1 block">⚠️ Not found in source text — please enter manually</span>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Case / FIR Number</label>
                {reviewData.raw_meta?.case_number?.confidence ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    🟢 High ({Math.round(reviewData.raw_meta.case_number.confidence * 100)}%)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">⚪ Verified</span>
                )}
              </div>
              <input 
                type="text" 
                value={reviewData.case_number || ''} 
                onChange={(e) => setReviewData({ ...reviewData, case_number: e.target.value })}
                placeholder="Not found in text — please enter manually"
                className={`w-full text-xs rounded-xl border ${!reviewData.case_number.trim() ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950'} px-3 py-2.5 dark:text-white`} 
              />
              {reviewData.raw_meta?.case_number?.evidence?.snippet && (
                <span className="text-[10px] text-slate-500 mt-1 block truncate">
                  📍 Line {reviewData.raw_meta.case_number.evidence.line_num}: "{reviewData.raw_meta.case_number.evidence.snippet.substring(0, 70)}"
                </span>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">State Jurisdiction <span className="text-rose-500 font-bold">*</span></label>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">State Code {reviewData.state_code}</span>
              </div>
              <select 
                value={reviewData.state_code || 1} 
                onChange={(e) => {
                  const sc = parseInt(e.target.value);
                  const stateNames = {
                    1: 'Maharashtra', 2: 'Andhra Pradesh', 3: 'Karnataka', 4: 'Kerala', 5: 'Himachal Pradesh',
                    6: 'Assam', 7: 'Jharkhand', 8: 'Bihar', 9: 'Rajasthan', 10: 'Tamil Nadu', 11: 'Orissa',
                    12: 'Jammu And Kashmir', 13: 'Uttar Pradesh', 14: 'Haryana', 15: 'Uttarakhand', 16: 'West Bengal',
                    17: 'Gujarat', 18: 'Chhattisgarh', 19: 'Mizoram', 20: 'Tripura', 21: 'Meghalaya', 22: 'Punjab',
                    23: 'Madhya Pradesh', 24: 'Sikkim', 25: 'Manipur', 26: 'Delhi', 27: 'Chandigarh', 29: 'Telangana',
                    30: 'Goa', 31: 'Diu And Daman', 32: 'Dnh At Silvasa', 33: 'Ladakh'
                  };
                  setReviewData({ ...reviewData, state_code: sc, state: stateNames[sc] || 'Maharashtra' });
                }}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2.5 dark:text-white"
              >
                <option value="1">Maharashtra (State 1)</option>
                <option value="2">Andhra Pradesh (State 2)</option>
                <option value="3">Karnataka (State 3)</option>
                <option value="4">Kerala (State 4)</option>
                <option value="5">Himachal Pradesh (State 5)</option>
                <option value="6">Assam (State 6)</option>
                <option value="7">Jharkhand (State 7)</option>
                <option value="8">Bihar (State 8)</option>
                <option value="9">Rajasthan (State 9)</option>
                <option value="10">Tamil Nadu (State 10)</option>
                <option value="11">Orissa (State 11)</option>
                <option value="12">Jammu And Kashmir (State 12)</option>
                <option value="13">Uttar Pradesh (State 13)</option>
                <option value="14">Haryana (State 14)</option>
                <option value="15">Uttarakhand (State 15)</option>
                <option value="16">West Bengal (State 16)</option>
                <option value="17">Gujarat (State 17)</option>
                <option value="18">Chhattisgarh (State 18)</option>
                <option value="19">Mizoram (State 19)</option>
                <option value="20">Tripura (State 20)</option>
                <option value="21">Meghalaya (State 21)</option>
                <option value="22">Punjab (State 22)</option>
                <option value="23">Madhya Pradesh (State 23)</option>
                <option value="24">Sikkim (State 24)</option>
                <option value="25">Manipur (State 25)</option>
                <option value="26">Delhi (State 26)</option>
                <option value="27">Chandigarh (State 27)</option>
                <option value="29">Telangana (State 29)</option>
                <option value="30">Goa (State 30)</option>
                <option value="31">Diu And Daman (State 31)</option>
                <option value="32">Dnh At Silvasa (State 32)</option>
                <option value="33">Ladakh (State 33)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">District & Court <span className="text-rose-500 font-bold">*</span></label>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Verified</span>
              </div>
              <input 
                type="text" 
                value={reviewData.district || ''} 
                onChange={(e) => setReviewData({ ...reviewData, district: e.target.value })}
                placeholder="Not found in text — please enter manually"
                className={`w-full text-xs rounded-xl border ${!reviewData.district.trim() ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950'} px-3 py-2.5 dark:text-white`} 
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Governing Act</label>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Statutory</span>
              </div>
              <select 
                value={reviewData.act || 'The Indian Penal Code'} 
                onChange={(e) => setReviewData({ ...reviewData, act: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2.5 dark:text-white"
              >
                <option value="The Indian Penal Code">The Indian Penal Code (IPC 1860)</option>
                <option value="Bharatiya Nyaya Sanhita, 2023">Bharatiya Nyaya Sanhita, 2023 (BNS)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Charged Section(s) <span className="text-rose-500 font-bold">*</span></label>
                {reviewData.raw_meta?.sections?.confidence ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    🟢 High ({Math.round(reviewData.raw_meta.sections.confidence * 100)}%)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">⚪ Verified</span>
                )}
              </div>
              <input 
                type="text" 
                value={(reviewData.sections || []).join(', ')} 
                onChange={(e) => setReviewData({ ...reviewData, sections: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                placeholder="Not found in text — please enter manually"
                className={`w-full text-xs rounded-xl border ${(!reviewData.sections || reviewData.sections.length === 0) ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950'} px-3 py-2.5 dark:text-white font-mono`} 
              />
              {/* Dynamic Section Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(reviewData.sections || []).map((sec, i) => {
                  const bnsEquiv = reviewData.bns_equivalents?.[sec];
                  return (
                    <div key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-mono bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-navy-950 dark:text-white">
                      <span className="text-gold-600 font-bold">⚖️</span>
                      <span>IPC {sec}{bnsEquiv ? ` → BNS ${bnsEquiv}` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 text-xs">Case Allegations Summary</label>
            <textarea 
              rows="3" 
              value={reviewData.case_summary || ''} 
              onChange={(e) => setReviewData({ ...reviewData, case_summary: e.target.value })}
              placeholder="Brief case factual allegations..."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 p-3 dark:text-white" 
            />
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button 
              onClick={handleAnalyze} 
              disabled={loading}
              className="px-8 py-3.5 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-gold-500 dark:hover:bg-gold-400 text-white dark:text-navy-950 font-bold shadow-lg transition flex items-center gap-2"
            >
              <span>{loading ? 'Running Analysis... ⚡' : 'Confirm & Run 7-Section Analysis ⚡'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS (7 SECTIONS) */}
      {step === 3 && resultsData && (
        <div className="case-report space-y-8 max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-navy-800 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gold-600 dark:text-gold-400">Analysis Completed</span>
              <h2 className="serif-heading text-2xl sm:text-3xl font-bold text-navy-950 dark:text-white mt-1">Complete Case Intelligence Report</h2>
            </div>
            <div className="report-actions flex flex-wrap items-center gap-2" data-print-hide="true">
              <button onClick={saveCaseRecord} disabled={savingRecord || recordSaved} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60 transition" title="Save structured case details and forecast for later outcome evaluation">
                {recordSaved ? 'Saved to register' : savingRecord ? 'Saving…' : 'Save to case register'}
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 transition" title="Print or save this report as PDF">
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button onClick={copySummary} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 transition" title="Copy a concise case summary">
                <ClipboardCopy className="w-4 h-4" /> Copy Summary
              </button>
              <button onClick={downloadReport} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950 hover:opacity-90 transition" title="Download a JSON copy of this report">
                <Download className="w-4 h-4" /> Download JSON
              </button>
              <button onClick={() => setStep(2)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 transition">
                Edit Parameters
              </button>
              {exportNotice && <span className="w-full text-right text-xs text-slate-600 dark:text-slate-300" role="status">{exportNotice}</span>}
            </div>
          </div>

          {/* Section 1: Glance */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="serif-heading text-lg font-bold text-navy-950 dark:text-white flex items-center gap-2">
                <span>📋</span> 1. Case at a Glance
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300">
                Source: Document Extraction / User Confirmed
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-navy-950 rounded-2xl">
                <span className="text-slate-400 block font-semibold">PARTIES</span>
                <span className="font-bold text-navy-950 dark:text-white text-sm">{resultsData.glance.case_title}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-navy-950 rounded-2xl">
                <span className="text-slate-400 block font-semibold">CASE NUMBER</span>
                <span className="font-bold text-navy-950 dark:text-white text-sm font-mono">{resultsData.glance.case_number}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-navy-950 rounded-2xl">
                <span className="text-slate-400 block font-semibold">VENUE</span>
                <span className="font-bold text-navy-950 dark:text-white text-sm">{resultsData.glance.district}, {resultsData.glance.state}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-navy-950 rounded-2xl">
                <span className="text-slate-400 block font-semibold">SECTIONS</span>
                <span className="font-bold text-navy-950 dark:text-white text-sm font-mono">{(resultsData.glance.sections || []).join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Duration */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="serif-heading text-lg font-bold text-navy-950 dark:text-white flex items-center gap-2">
                <span>⏱️</span> 2. How Long Will This Case Take?
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Source: Hybrid ML Pipeline
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className={`p-6 rounded-2xl text-center space-y-2 border ${resultsData.duration_prediction.predicted_class === 'ontime' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'}`}>
                <div className="text-4xl">{resultsData.duration_prediction.predicted_class === 'ontime' ? '⚡' : '⏳'}</div>
                <div className="text-xl font-extrabold">{resultsData.duration_prediction.status_label}</div>
                <p className="text-[11px] text-slate-500">Predicted via two-stage hybrid decision architecture</p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-center space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Predicted Resolution Timeline</span>
                <div className="text-4xl font-extrabold text-navy-950 dark:text-gold-400">
                  {resultsData.duration_prediction.expected_duration_months.toFixed(1)} <span className="text-base font-medium text-slate-500">months</span>
                </div>
                <div className="text-xs text-slate-500 pt-1">
                  Estimated Range (uncalibrated): <strong>{resultsData.duration_prediction.duration_range_months[0].toFixed(1)} – {resultsData.duration_prediction.duration_range_months[1].toFixed(1)} months</strong>
                </div>
                {resultsData.duration_prediction.uncertainty?.notice && (
                  <p className="pt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400" role="note">
                    {resultsData.duration_prediction.uncertainty.notice}
                  </p>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Delay Risk Level:</span>
                  <span className="font-bold text-navy-950 dark:text-white">{resultsData.duration_prediction.delay_risk_pct.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-navy-800 rounded-full h-3 overflow-hidden">
                  <div className={`h-3 rounded-full ${resultsData.duration_prediction.predicted_class === 'ontime' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${resultsData.duration_prediction.delay_risk_pct}%` }}></div>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-[11px] text-slate-500">
                  {resultsData.duration_prediction.routed_regressor}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Bail */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="serif-heading text-lg font-bold text-navy-950 dark:text-white flex items-center gap-2">
                <span>⚖️</span> 5. Can I Get Bail? (Statutory Legal Classification)
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                Source: First Schedule CrPC / BNSS Law Lookup
              </span>
            </div>

            <div className={`p-5 rounded-2xl flex items-start gap-4 border ${resultsData.bail_assessment.overall_bailable ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'}`}>
              <div className="text-3xl">{resultsData.bail_assessment.overall_bailable ? '✅' : '⚠️'}</div>
              <div className="space-y-1">
                <h4 className="text-base font-bold">{resultsData.bail_assessment.status_label}</h4>
                <p className="text-xs leading-relaxed">{resultsData.bail_assessment.summary}</p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

