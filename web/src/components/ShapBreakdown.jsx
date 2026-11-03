import React from 'react';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

export default function ShapBreakdown({ features = [], modelTrained = false }) {

  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-6 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-navy-800">
        <div>
          <h4 className="serif-heading text-base font-bold text-navy-950 dark:text-white">
            Why this estimate?
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Plain-language factors derived from the case details; these are not SHAP values or causal effects.
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4" />
        </div>
      </div>

      {features.length > 0 ? <div className="space-y-3">
        {features.map((item, idx) => {
          const isIncrease = item.direction === 'increase_delay' || item.impact.startsWith('+');
          return (
            <div 
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-navy-800/80 transition-all hover:border-slate-200 dark:hover:border-navy-700"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-lg ${isIncrease ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
                  {isIncrease ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {item.feature}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  isIncrease 
                    ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' 
                    : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {item.impact}
                </span>
              </div>
            </div>
          );
        })}
      </div> : (
        <p className="rounded-xl border border-slate-200 dark:border-navy-800 p-4 text-sm text-slate-600 dark:text-slate-300">
          No case-specific explanation factors were returned for this estimate.
        </p>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 italic">
        {modelTrained
          ? 'Factors summarize relevant case inputs; they do not quantify a calibrated per-feature effect.'
          : 'This estimate uses the research-benchmark fallback; these factors do not come from a trained local model.'}
      </p>
    </div>
  );
}

