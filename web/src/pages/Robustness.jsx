import React, { useState, useEffect } from 'react';
import { ShieldCheck, Scale, CheckCircle2, AlertTriangle, ArrowRight, Activity } from 'lucide-react';

export default function Robustness() {
  const [robustnessData, setRobustnessData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/robustness')
      .then(response => {
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
        return response.json();
      })
      .then(data => setRobustnessData(data))
      .catch(error => setRobustnessData({ status: 'unavailable', message: error.message }))
      .finally(() => setLoading(false));
  }, []);

  const formatTStatistic = (test) => Number.isFinite(test?.t_statistic)
    ? `t = ${test.t_statistic.toFixed(3)}`
    : 'Not run';
  const formatPValue = (test) => {
    if (!Number.isFinite(test?.p_value)) return 'Not run';
    return test.p_value < 0.001 ? 'p < 0.001' : `p = ${test.p_value.toFixed(3)}`;
  };
  const formatDelta = (delta) => Number.isFinite(delta) ? `|Δt| = ${delta.toFixed(3)}` : 'Not run';
  const auditA = robustnessData?.perturbation_a;
  const auditB = robustnessData?.perturbation_b;
  const hasAuditResults = Boolean(auditA || auditB);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-12">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-500/10 px-3 py-1 rounded-full border border-gold-200 dark:border-gold-500/20">
          Fairness & Auditability
        </span>
        <h2 className="serif-heading text-3xl sm:text-4xl font-bold text-navy-950 dark:text-white mt-3">
          Demographic Perturbation & Bias Auditing
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
          These saved sensitivity checks compare group outcome rates before and after demographic perturbations. They are descriptive audits, not proof of model fairness or legal suitability.
        </p>
      </div>

      <div role="status" className={`p-4 rounded-xl border text-sm ${hasAuditResults ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}>
        {loading
          ? 'Loading the latest saved audit report…'
          : hasAuditResults
            ? 'Showing values from the latest saved robustness run.'
            : robustnessData?.message || 'No robustness audit report is available. Run the robustness stage to generate one.'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Experiment A */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm space-y-5 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Experiment A</span>
              <h3 className="serif-heading text-xl font-bold text-navy-950 dark:text-white mt-0.5">
                Unknown Category Reassignment
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Reassigns unknown demographic codes using the observed group ratio, then compares t-tests on recorded outcome rates. This stage does not retrain the classifier.
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-800 space-y-2 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-slate-500 dark:text-slate-400">Pre-Reassignment t-statistic:</span>
              <span className="font-mono font-bold text-navy-950 dark:text-white">{formatTStatistic(auditA?.pre_reassignment)} ({formatPValue(auditA?.pre_reassignment)})</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-500 dark:text-slate-400">Post-Reassignment t-statistic:</span>
              <span className="font-mono font-bold text-navy-950 dark:text-white">{formatTStatistic(auditA?.post_reassignment)} ({formatPValue(auditA?.post_reassignment)})</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-slate-200/60 dark:border-navy-800 text-emerald-600 dark:text-emerald-400">
              <span>Absolute t-statistic change:</span>
              <span className="font-bold">{formatDelta(auditA?.delta_t_statistic)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            <strong>Recorded audit status:</strong> {auditA?.fairness_status || 'Not run'}. A stable t-statistic alone does not establish fairness across model errors or calibration.
          </p>
        </div>

        {/* Experiment B */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm space-y-5 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Experiment B</span>
              <h3 className="serif-heading text-xl font-bold text-navy-950 dark:text-white mt-0.5">
                10% Demographic Flipping
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Randomly flips a configured share of records in the demographic field, then compares t-tests on recorded outcome rates. This is not a feature-importance or model-retraining test.
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-navy-800 space-y-2 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-slate-500 dark:text-slate-400">Pre-Flip t-statistic:</span>
              <span className="font-mono font-bold text-navy-950 dark:text-white">{formatTStatistic(auditB?.pre_flip)} ({formatPValue(auditB?.pre_flip)})</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-500 dark:text-slate-400">Post-10%-Flip t-statistic:</span>
              <span className="font-mono font-bold text-navy-950 dark:text-white">{formatTStatistic(auditB?.post_flip)} ({formatPValue(auditB?.post_flip)})</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-slate-200/60 dark:border-navy-800 text-amber-600 dark:text-amber-400">
              <span>Absolute t-statistic change:</span>
              <span className="font-bold">{formatDelta(auditB?.delta_t_statistic)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            <strong>Records flipped:</strong> {Number.isFinite(auditB?.flipped_records_count) ? auditB.flipped_records_count : 'Not run'}. <strong>Recorded audit status:</strong> {auditB?.stability_status || 'Not run'}.
          </p>
        </div>
      </div>
    </div>
  );
}

