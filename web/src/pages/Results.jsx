import React, { useState, useEffect } from 'react';
import { AlertCircle, Award, CheckCircle2 } from 'lucide-react';

export default function Results() {
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const paperReferences = {
    classifier: { accuracy: 0.8, f1_score: 84.1 },
    regressor_ontime: { rmse: 4.9 },
    regressor_delayed: { rmse: 13.79 },
    hybrid_approach_4: { rmse: 12.15, accuracy: 0.825 },
  };

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setMetricsData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const metricDefinitions = [
    {
      model: "Classifier (Model 1c DRF)",
      metric: "Accuracy",
      group: "classifier",
      key: "accuracy",
      benchmarkGroup: "classifier",
      format: "decimal",
    },
    {
      model: "Classifier (Model 1c DRF)",
      metric: "F1 Delay Score",
      group: "classifier",
      key: "f1_score",
      benchmarkGroup: "classifier",
      format: "percent",
    },
    {
      model: "Regressor (Model 2a On-Time)",
      metric: "RMSE (Duration)",
      group: "regressor_ontime",
      key: "rmse",
      benchmarkGroup: "regressor_ontime",
      format: "months",
    },
    {
      model: "Regressor (Model 2b Delayed)",
      metric: "RMSE (Duration)",
      group: "regressor_delayed",
      key: "rmse",
      benchmarkGroup: "regressor_delayed",
      format: "months",
    },
    {
      model: "Hybrid Consensus System (Appr 4)",
      metric: "RMSE (Global)",
      group: "hybrid_approach_4",
      key: "rmse",
      benchmarkGroup: "hybrid_approach_4",
      format: "months",
    },
    {
      model: "Hybrid Consensus System (Appr 4)",
      metric: "Classification Acc",
      group: "hybrid_approach_4",
      key: "accuracy",
      benchmarkGroup: "hybrid_approach_4",
      format: "decimal",
    },
  ];

  const formatMetric = (value, format) => {
    if (!Number.isFinite(value)) return 'Not available';
    if (format === 'percent') return `${value.toFixed(2)}%`;
    if (format === 'months') return `${value.toFixed(2)} mo`;
    return value.toFixed(4);
  };

  const benchmarkRows = metricDefinitions.map((definition) => {
    const measuredGroup = metricsData?.measured?.[definition.group] || {};
    const rawMeasured = measuredGroup[definition.key];
    const benchmarkGroup = metricsData?.benchmarks?.[definition.benchmarkGroup] || {};
    const rawBenchmark = benchmarkGroup[definition.key]
      ?? paperReferences[definition.benchmarkGroup]?.[definition.key];
    const groupStatus = measuredGroup.status || (
      definition.group === 'hybrid_approach_4' && metricsData?.measured?.hybrid?.status === 'partial_models'
        ? 'partial_models'
        : null
    );
    const fallbackOnly = ['benchmark_fallback', 'loaded_cached', 'partial_models'].includes(groupStatus);
    const hasMeasured = !fallbackOnly && typeof rawMeasured === 'number' && Number.isFinite(rawMeasured);
    const hasBenchmark = typeof rawBenchmark === 'number' && Number.isFinite(rawBenchmark);

    return {
      model: definition.model,
      metric: definition.metric,
      measured: hasMeasured
        ? formatMetric(rawMeasured, definition.format)
        : fallbackOnly
          ? 'Reference only'
          : metricsData
            ? 'Not run'
            : 'Unavailable',
      benchmark: hasBenchmark ? formatMetric(rawBenchmark, definition.format) : 'Not available',
      diff: hasMeasured && hasBenchmark
        ? `${rawMeasured - rawBenchmark >= 0 ? '+' : ''}${formatMetric(rawMeasured - rawBenchmark, definition.format)}`
        : '—',
      status: hasMeasured ? 'Measured' : fallbackOnly ? 'Reference' : metricsData ? 'Not run' : 'Unavailable',
      hasMeasured,
    };
  });
  const hasMeasuredResults = benchmarkRows.some((row) => row.hasMeasured);
  const reportStatus = loading
    ? 'Loading evaluation'
    : !metricsData
      ? 'Metrics API unavailable'
      : hasMeasuredResults
        ? 'Measured evaluation available'
        : metricsData.status === 'empty'
          ? 'No evaluation run'
          : 'No measured metrics';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-12">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-500/10 px-3 py-1 rounded-full border border-gold-200 dark:border-gold-500/20">
          Empirical Validation
        </span>
        <h2 className="serif-heading text-3xl sm:text-4xl font-bold text-navy-950 dark:text-white mt-3">
          Benchmark Verification & Ablation Results
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
          Local measurements appear only after an evaluation run. Paper values are shown separately as reference targets; fallback estimates are never labeled as measured.
        </p>
      </div>

      {/* Primary Benchmark Table */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-800 overflow-hidden shadow-sm transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center">
          <div>
            <h3 className="serif-heading text-lg font-bold text-navy-950 dark:text-white">
              Benchmark Target Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Published paper values are reference targets, not proof of a local run.
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${hasMeasuredResults ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>
            {hasMeasuredResults ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{reportStatus}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-navy-800">
              <tr>
                <th className="px-6 py-4">Model Pipeline Stage</th>
                <th className="px-6 py-4">Evaluation Metric</th>
                <th className="px-6 py-4">Measured Value</th>
                <th className="px-6 py-4">Paper Benchmark</th>
                <th className="px-6 py-4">Difference</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-700 dark:text-slate-200">
              {benchmarkRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="px-6 py-4 font-semibold text-navy-950 dark:text-white">{r.model}</td>
                  <td className="px-6 py-4">{r.metric}</td>
                  <td className="px-6 py-4 font-bold text-gold-600 dark:text-gold-400">{r.measured}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{r.benchmark}</td>
                  <td className="px-6 py-4 font-mono text-xs">{r.diff}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.hasMeasured ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Baseline vs Hybrid Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approach 0 · Paper Benchmark</span>
          <h4 className="serif-heading text-xl font-bold text-navy-950 dark:text-white">Monolithic Regression Baseline</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The published paper reports a global RMSE of <strong>14.85 months</strong> for its monolithic regression baseline. This is a reference value, not a measurement from the current local run.
          </p>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex justify-between items-center text-sm">
            <span>Paper benchmark RMSE</span>
            <span className="font-bold text-rose-500">14.85 months</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-900 to-navy-950 text-white space-y-4 border border-navy-800 shadow-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Approach 4 · Paper Benchmark</span>
          <h4 className="serif-heading text-xl font-bold text-white">Hybrid Two-Stage Consensus Architecture</h4>
          <p className="text-sm text-slate-300">
            The paper reports <strong>12.15 months</strong> RMSE for the consensus approach, 18.2% lower than its baseline. These figures describe the published evaluation and are not local run results.
          </p>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center text-sm">
            <span>Paper benchmark RMSE</span>
            <span className="font-bold text-gold-400">12.15 months (-2.70 mo)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

