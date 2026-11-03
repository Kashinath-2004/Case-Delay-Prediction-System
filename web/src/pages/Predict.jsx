import React, { useState, useEffect } from 'react';
import { Scale, ArrowRight, RefreshCw, AlertCircle, Sparkles, Building2, Gavel, Calendar } from 'lucide-react';
import RiskGauge from '../components/RiskGauge';
import ShapBreakdown from '../components/ShapBreakdown';

export default function Predict() {
  const [states, setStates] = useState([
    { code: 1, name: "Maharashtra" },
    { code: 2, name: "Uttar Pradesh" },
    { code: 3, name: "Karnataka" },
    { code: 4, name: "Gujarat" },
    { code: 5, name: "Tamil Nadu" },
    { code: 6, name: "Madhya Pradesh" },
    { code: 7, name: "Rajasthan" },
    { code: 8, name: "Bihar" },
    { code: 9, name: "West Bengal" },
    { code: 10, name: "Kerala" },
  ]);
  const [districts, setDistricts] = useState([
    { code: 1, name: "Central District" },
    { code: 2, name: "North District" },
    { code: 3, name: "South District" },
    { code: 4, name: "Metropolitan District" }
  ]);

  const [formData, setFormData] = useState({
    state_code: 1,
    dist_code: 1,
    court_no: 1,
    case_type_code: 1,
    section: 302,
    bailable_ipc: 0,
    number_sections_category: '1 to 2',
    filing_judge_tenure_months: 14.0
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch real states from API if available
  useEffect(() => {
    fetch('/api/codebook/states')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data && data.length > 0) setStates(data);
      })
      .catch(() => {});
  }, []);

  // Update districts when state changes
  useEffect(() => {
    fetch(`/api/codebook/districts/${formData.state_code}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          setDistricts(data);
          setFormData(prev => ({ ...prev, dist_code: data[0].code }));
        }
      })
      .catch(() => {});
  }, [formData.state_code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status === 'error') {
        throw new Error(data.message || 'The prediction service could not complete this request.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'The prediction service is unavailable.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-10">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-500/10 px-3 py-1 rounded-full border border-gold-200 dark:border-gold-500/20">
          Interactive Case Scoring
        </span>
        <h2 className="serif-heading text-2xl sm:text-3xl font-bold text-navy-950 dark:text-white mt-3">
          Predict Filing-Time Case Resolution Timeline
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
          Enter case details available on the day of formal registry. The two-stage hybrid engine will assess delay probability and forecast expected disposal duration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-800 p-6 sm:p-8 shadow-sm transition-colors">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Jurisdiction Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>1. Venue & Jurisdiction</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State Court</label>
                <select
                  value={formData.state_code}
                  onChange={e => setFormData({ ...formData, state_code: parseInt(e.target.value) })}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2.5 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {states.map(s => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">District Court</label>
                <select
                  value={formData.dist_code}
                  onChange={e => setFormData({ ...formData, dist_code: parseInt(e.target.value) })}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2.5 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {districts.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Legal Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-navy-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                <Gavel className="w-3.5 h-3.5" />
                <span>2. Offense & Penal Code</span>
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">IPC Section</label>
                  <input
                    type="number"
                    value={formData.section}
                    onChange={e => setFormData({ ...formData, section: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 302"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bail Status</label>
                  <select
                    value={formData.bailable_ipc}
                    onChange={e => setFormData({ ...formData, bailable_ipc: parseInt(e.target.value) })}
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    <option value={0}>Non-Bailable</option>
                    <option value={1}>Bailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sections Count Category</label>
                <select
                  value={formData.number_sections_category}
                  onChange={e => setFormData({ ...formData, number_sections_category: e.target.value })}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-3 py-2.5 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="1 to 2">1 to 2 Sections</option>
                  <option value="3 to 5">3 to 5 Sections</option>
                  <option value="6 to 10">6 to 10 Sections</option>
                  <option value="More than 10">More than 10 Sections</option>
                </select>
              </div>
            </div>

            {/* Judge Tenure Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-navy-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>3. Presiding Bench</span>
              </h4>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Judge Tenure at Filing</label>
                  <span className="text-xs font-bold text-gold-600 dark:text-gold-400">{formData.filing_judge_tenure_months} months</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="48"
                  value={formData.filing_judge_tenure_months}
                  onChange={e => setFormData({ ...formData, filing_judge_tenure_months: parseFloat(e.target.value) })}
                  className="w-full accent-gold-500 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-gold-500 dark:hover:bg-gold-400 text-white dark:text-navy-950 font-bold shadow-md transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluating Hybrid Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Predictive Inference</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-6">
          {error ? (
            <div role="alert" className="min-h-[280px] flex flex-col items-center justify-center p-8 rounded-3xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-center">
              <AlertCircle className="w-9 h-9 text-rose-600 dark:text-rose-400 mb-3" />
              <h4 className="serif-heading font-bold text-lg text-rose-900 dark:text-rose-200">Prediction unavailable</h4>
              <p className="text-sm text-rose-800 dark:text-rose-300 max-w-md mt-2">{error}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mt-2">Check that the API is running, then submit again. This page will not substitute a simulated prediction.</p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${result.model_trained ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                <span className={`w-2 h-2 rounded-full ${result.model_trained ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {result.model_trained ? 'Trained local model' : 'Research-benchmark fallback · local models not trained'}
              </div>
              {/* Top Banner: Duration Forecast */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold-500/20 text-gold-400 border border-gold-500/30">
                    Routed to: {result.routed_regressor}
                  </div>
                  
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Forecasted Case Duration</div>
                    <div className="text-4xl sm:text-5xl font-extrabold text-white mt-1">
                      {result.predicted_duration_months} <span className="text-xl sm:text-2xl text-gold-400 font-semibold">months</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-300">Estimated range (uncalibrated):</span>
                    <span className="font-bold text-gold-400">
                      {result.duration_range_months ? `${result.duration_range_months[0]} – ${result.duration_range_months[1]} months` : '± 3.5 mo'}
                    </span>
                  </div>
                  {result.uncertainty?.notice && (
                    <p className="text-[11px] leading-relaxed text-slate-300" role="note">
                      {result.uncertainty.notice}
                    </p>
                  )}
                </div>
              </div>

              {/* Gauge & Class Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RiskGauge riskPct={result.delay_risk_pct} predictedClass={result.predicted_class} />

                <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="serif-heading font-bold text-base text-navy-950 dark:text-white">Classification Confidence</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {result.model_trained ? 'Model 1c (DRF) probability split:' : 'Illustrative fallback risk estimate:'}
                    </p>
                    <div className="space-y-3 mt-4">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-emerald-600 dark:text-emerald-400">On-Time Estimate</span>
                          <span>{result.ontime_confidence_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-navy-950 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${result.ontime_confidence_pct}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-rose-600 dark:text-rose-400">Delay-Risk Estimate</span>
                          <span>{result.delay_risk_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-navy-950 h-2 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${result.delay_risk_pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-navy-800 text-[11px] text-slate-400">
                    {result.model_trained
                      ? 'Threshold ≥ 85% routes to a specialist; otherwise uses the baseline.'
                      : 'Fallback risk values are benchmark estimates, not probabilities from a trained local classifier.'}
                  </div>
                </div>
              </div>

              {/* SHAP Breakdown */}
              <ShapBreakdown features={result.top_features} modelTrained={result.model_trained} />
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-navy-800 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-navy-900 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
                <Scale className="w-8 h-8" />
              </div>
              <h4 className="serif-heading font-bold text-lg text-navy-950 dark:text-white">Awaiting Case Submission</h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                Configure case attributes in the panel to the left and click "Run Predictive Inference" to simulate two-stage resolution.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

