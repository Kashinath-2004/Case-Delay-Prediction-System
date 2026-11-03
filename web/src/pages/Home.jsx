import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Clock, Cpu, RefreshCw, Scale, ShieldAlert } from 'lucide-react';
import PipelineDiagram from '../components/PipelineDiagram';

export default function Home({ setActivePage }) {
  const [apiStatus, setApiStatus] = useState('checking');
  const [modelInfo, setModelInfo] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refreshReadiness = async () => {
    setRefreshing(true);
    setStatusError('');

    try {
      const healthResponse = await fetch('/api/health');
      if (!healthResponse.ok) throw new Error(`Health check returned HTTP ${healthResponse.status}`);
      setApiStatus('connected');
    } catch (error) {
      setApiStatus('offline');
      setModelInfo(null);
      setStatusError(error.message || 'API is unavailable');
      setRefreshing(false);
      return;
    }

    try {
      const modelResponse = await fetch('/api/model-info');
      if (!modelResponse.ok) throw new Error(`Model status returned HTTP ${modelResponse.status}`);
      setModelInfo(await modelResponse.json());
    } catch (error) {
      setModelInfo(null);
      setStatusError(error.message || 'Model status is unavailable');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshReadiness();
  }, []);

  const trainedModels = modelInfo?.trained_models;
  const availableModelCount = trainedModels
    ? Object.values(trainedModels).filter(Boolean).length
    : null;
  const hasLocalClassifier = trainedModels?.classifier_1c_drf === true;
  const statusIcon = apiStatus === 'connected' ? CheckCircle2 : apiStatus === 'offline' ? AlertCircle : Activity;
  const StatusIcon = statusIcon;

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-navy-900/5 dark:bg-gold-500/10 border border-navy-900/10 dark:border-gold-500/20 text-xs font-semibold text-navy-800 dark:text-gold-400">
          <Scale className="w-3.5 h-3.5" />
          <span>Empirical Judicial Analytics · Indian Lower Courts</span>
        </div>

        <h1 className="serif-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-950 dark:text-white tracking-tight leading-[1.15]">
          Predicting Criminal Case Delays & Backlog Durations with <span className="text-gold-600 dark:text-gold-400">Explainable AI</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          A production replication of the state-of-the-art two-stage hybrid machine learning pipeline that forecasts court resolution timelines at the exact moment of filing.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <button
            onClick={() => setActivePage('analyze')}
            className="px-6 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-gold-500 dark:hover:bg-gold-400 text-white dark:text-navy-950 font-bold shadow-lg shadow-navy-900/10 dark:shadow-gold-500/20 flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <span>Upload Case File for Analysis</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActivePage('results')}
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-navy-900 dark:hover:bg-navy-800 text-navy-900 dark:text-white border border-slate-200 dark:border-navy-700 font-semibold shadow-sm transition-all"
          >
            <span>View Benchmark Results</span>
          </button>
        </div>
      </section>

      {/* Live API and Model Readiness */}
      <section aria-label="System readiness" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-y border-slate-200 dark:border-navy-800 bg-white/70 dark:bg-navy-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-navy-800">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${apiStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : apiStatus === 'offline' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 animate-pulse'}`} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-navy-950 dark:text-white">System readiness</h2>
            </div>
            <button
              type="button"
              onClick={refreshReadiness}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-navy-800"
              title="Refresh API and model status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-navy-800">
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">API connection</p>
              <p className={`mt-1 text-sm font-semibold ${apiStatus === 'connected' ? 'text-emerald-700 dark:text-emerald-400' : apiStatus === 'offline' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {apiStatus === 'connected' ? 'Connected' : apiStatus === 'offline' ? 'Unavailable' : 'Checking…'}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Local model artifacts</p>
              <p className="mt-1 text-sm font-semibold text-navy-950 dark:text-white">
                {availableModelCount === null ? 'Status unavailable' : `${availableModelCount} of 4 available`}
              </p>
              {availableModelCount !== null && (
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {hasLocalClassifier ? 'Local classifier present' : 'No local classifier found'}
                </p>
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prediction mode</p>
              <p className="mt-1 text-sm font-semibold text-navy-950 dark:text-white">
                {apiStatus !== 'connected' || !modelInfo
                  ? 'Unknown'
                  : hasLocalClassifier
                    ? 'Local model inference'
                    : 'Research-benchmark fallback'}
              </p>
              {apiStatus === 'connected' && modelInfo && !hasLocalClassifier && (
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">No trained classifier artifact is installed.</p>
              )}
            </div>
          </div>
          {statusError && (
            <p role="status" className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-navy-800 dark:text-slate-400">
              {statusError}
            </p>
          )}
        </div>
      </section>

      {/* Interactive Architecture Section */}
      <section className="max-w-6xl mx-auto">
        <PipelineDiagram />
      </section>

      {/* Key Innovation Highlights */}
      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <h4 className="serif-heading font-bold text-lg text-navy-950 dark:text-white">Strict Leakage Prevention</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Eliminates all future information available only after trial initiation (judge transfers, hearings, interim orders), ensuring true filing-time utility.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h4 className="serif-heading font-bold text-lg text-navy-950 dark:text-white">Consensus Thresholding</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Routes ambiguous cases to a robust monolithic safety net when classifier confidence is below 85%, achieving superior global stability.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h4 className="serif-heading font-bold text-lg text-navy-950 dark:text-white">Statistical Fairness Auditing</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Audited using demographic reassignment and 10% gender flips with two-sample t-tests to ensure predictions are free of algorithmic disparity.
          </p>
        </div>
      </section>
    </div>
  );
}

