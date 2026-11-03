import React, { useEffect, useState } from 'react';
import { Activity, CalendarCheck2, ClipboardList, Trash2 } from 'lucide-react';

const API = '/api';

export default function CaseRegister({ token }) {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [form, setForm] = useState({});

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [caseResponse, summaryResponse] = await Promise.all([
        fetch(`${API}/cases`, { headers }),
        fetch(`${API}/cases/evaluation`, { headers }),
      ]);
      if (!caseResponse.ok || !summaryResponse.ok) throw new Error('Could not load your case register. Please sign in again.');
      setRecords(await caseResponse.json());
      setSummary(await summaryResponse.json());
    } catch (requestError) {
      setError(requestError.message || 'Could not load saved cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, [token]);

  const updateForm = (caseId, key, value) => {
    setForm((current) => ({ ...current, [caseId]: { ...current[caseId], [key]: value } }));
  };

  const saveOutcome = async (event, record) => {
    event.preventDefault();
    const values = form[record.id] || {};
    setSavingId(record.id);
    setError('');
    try {
      const response = await fetch(`${API}/cases/${record.id}/outcome`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_duration_months: Number(values.actual_duration_months),
          actual_disposition_date: values.actual_disposition_date || null,
          actual_disposition: values.actual_disposition || null,
          outcome_note: values.outcome_note || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Could not save outcome.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message || 'Could not save outcome.');
    } finally {
      setSavingId('');
    }
  };

  const removeRecord = async (record) => {
    if (!window.confirm(`Delete the saved record for ${record.case_title}? This cannot be undone.`)) return;
    const response = await fetch(`${API}/cases/${record.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setError('Could not delete the case record.');
      return;
    }
    await loadRecords();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-navy-800 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-gold-700 dark:text-gold-400">Longitudinal evaluation</p>
          <h1 className="serif-heading mt-2 text-3xl font-bold text-navy-950 dark:text-white">Case register</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Save a reviewed estimate, then record the actual case duration when it is disposed. Error summaries use only cases with recorded outcomes.</p>
        </div>
        <button onClick={loadRecords} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-navy-700 dark:text-slate-200 dark:hover:bg-navy-900">Refresh records</button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border-y border-slate-200 dark:border-navy-800 divide-x divide-slate-200 dark:divide-navy-800">
        <Metric label="Saved cases" value={summary?.total_cases ?? '—'} icon={<ClipboardList className="w-4 h-4" />} />
        <Metric label="Outcomes recorded" value={summary?.completed_outcomes ?? '—'} icon={<CalendarCheck2 className="w-4 h-4" />} />
        <Metric label="Awaiting outcome" value={summary?.pending_outcomes ?? '—'} icon={<Activity className="w-4 h-4" />} />
        <Metric label="MAE (months)" value={summary?.mae_months == null ? '—' : summary.mae_months.toFixed(2)} icon={<Activity className="w-4 h-4" />} />
        <Metric label="RMSE (months)" value={summary?.rmse_months == null ? '—' : summary.rmse_months.toFixed(2)} icon={<Activity className="w-4 h-4" />} />
        <Metric label={`Class accuracy · ${summary?.threshold_months ?? 24} mo`} value={summary?.classification_accuracy_pct == null ? '—' : `${summary.classification_accuracy_pct.toFixed(1)}%`} icon={<Activity className="w-4 h-4" />} />
      </section>
      <p className="-mt-5 text-xs text-slate-500 dark:text-slate-400">{summary?.note || 'Evaluation uses only cases with user-entered actual durations; it is not a benchmark test set.'}{summary?.mean_error_months != null ? ` Signed bias: ${summary.mean_error_months > 0 ? '+' : ''}${summary.mean_error_months.toFixed(2)} months (positive means estimates run longer than observed).` : ''}</p>

      {summary?.completed_outcomes > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
            <div className="border-b border-slate-200 dark:border-navy-800 px-4 py-3">
              <h2 className="text-sm font-bold text-navy-950 dark:text-white">24-month classification check</h2>
              <p className="mt-1 text-xs text-slate-500">Actual class derives from entered duration; predicted class comes from the saved forecast.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-navy-950"><tr><th className="px-4 py-2">Actual</th><th className="px-4 py-2">Predicted on-time</th><th className="px-4 py-2">Predicted delayed</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200">
                  <tr><th className="px-4 py-3 font-semibold">On-time</th><td className="px-4 py-3">{summary.confusion_matrix.actual_ontime_predicted_ontime}</td><td className="px-4 py-3">{summary.confusion_matrix.actual_ontime_predicted_delayed}</td></tr>
                  <tr><th className="px-4 py-3 font-semibold">Delayed</th><td className="px-4 py-3">{summary.confusion_matrix.actual_delayed_predicted_ontime}</td><td className="px-4 py-3">{summary.confusion_matrix.actual_delayed_predicted_delayed}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="px-4 pb-3 text-[11px] text-slate-500">Included classifications: {summary.classification_cases}</p>
          </div>

          <div className="border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
            <div className="border-b border-slate-200 dark:border-navy-800 px-4 py-3">
              <h2 className="text-sm font-bold text-navy-950 dark:text-white">Duration error by prediction mode</h2>
              <p className="mt-1 text-xs text-slate-500">Modes are kept separate so fallback results are not merged with trained-model results.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-navy-950"><tr><th className="px-4 py-2">Mode</th><th className="px-4 py-2">Cases</th><th className="px-4 py-2">MAE</th><th className="px-4 py-2">RMSE</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200">
                  {Object.entries(summary.by_prediction_mode || {}).map(([mode, metrics]) => (
                    <tr key={mode}><th className="px-4 py-3 font-semibold">{mode === 'trained_local_model' ? 'Trained local model' : mode === 'research_benchmark_fallback' ? 'Benchmark fallback' : mode}</th><td className="px-4 py-3">{metrics.case_count}</td><td className="px-4 py-3">{metrics.mae_months.toFixed(2)} mo</td><td className="px-4 py-3">{metrics.rmse_months.toFixed(2)} mo</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading your case register…</p>
      ) : records.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-navy-700 px-6 py-14 text-center">
          <ClipboardList className="mx-auto w-8 h-8 text-slate-400" />
          <h2 className="mt-3 font-semibold text-navy-950 dark:text-white">No saved cases yet</h2>
          <p className="mt-1 text-sm text-slate-500">Run a case analysis, then select “Save to case register” in its report.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <article key={record.id} className="border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-navy-950 dark:text-white">{record.case_title}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${record.prediction_mode === 'trained_local_model' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>
                      {record.prediction_mode === 'trained_local_model' ? 'Trained local model' : 'Benchmark fallback'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{record.case_number || 'No case number'} · {record.district || 'District not recorded'}, {record.state || 'State not recorded'} · Sections {(record.sections || []).join(', ') || '—'}</p>
                  <p className="mt-2 text-[11px] text-slate-400">Saved {new Date(record.created_at * 1000).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Forecast</p>
                    <p className="mt-1 text-xl font-bold text-navy-950 dark:text-white">{record.forecast_months == null ? '—' : `${record.forecast_months.toFixed(1)} mo`}</p>
                    <p className="text-xs text-slate-500">{record.predicted_class || 'No class'} · {record.delay_risk_pct == null ? '—' : `${record.delay_risk_pct.toFixed(1)}% risk`}</p>
                  </div>
                  <button onClick={() => removeRecord(record)} title="Delete saved case" className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/50 px-5 py-4">
                {record.has_outcome ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div><span className="font-semibold text-slate-700 dark:text-slate-200">Actual outcome:</span> <span className="text-slate-600 dark:text-slate-400">{record.actual_duration_months.toFixed(1)} months{record.actual_disposition ? ` · ${record.actual_disposition}` : ''}</span></div>
                    <div className="text-right"><span className="text-xs text-slate-500">Absolute duration error</span><p className="font-bold text-navy-950 dark:text-white">{record.absolute_error_months.toFixed(2)} months</p></div>
                  </div>
                ) : (
                  <form onSubmit={(event) => saveOutcome(event, record)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-3">
                    <div><label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Actual duration (months) *</label><input required type="number" min="0.1" max="1200" step="0.1" value={form[record.id]?.actual_duration_months || ''} onChange={(event) => updateForm(record.id, 'actual_duration_months', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white" placeholder="e.g. 18.5" /></div>
                    <div><label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Disposition date</label><input type="date" value={form[record.id]?.actual_disposition_date || ''} onChange={(event) => updateForm(record.id, 'actual_disposition_date', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></div>
                    <div><label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Outcome</label><select value={form[record.id]?.actual_disposition || ''} onChange={(event) => updateForm(record.id, 'actual_disposition', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white"><option value="">Select disposition</option><option>Conviction</option><option>Acquittal</option><option>Compounded</option><option>Withdrawn</option><option>Dismissed</option><option>Other / not recorded</option></select></div>
                    <button disabled={savingId === record.id} className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50 dark:bg-gold-500 dark:text-navy-950">{savingId === record.id ? 'Saving…' : 'Record outcome'}</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Local demo storage only. These records are not encrypted at rest; do not enter sensitive real-world case data. Uploaded documents and source text are never stored in this register.</p>
    </div>
  );
}

function Metric({ label, value, icon }) {
  return <div className="px-4 py-4"><div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">{icon}<span className="text-[10px] font-bold uppercase tracking-wide">{label}</span></div><p className="mt-2 text-2xl font-bold text-navy-950 dark:text-white">{value}</p></div>;
}
