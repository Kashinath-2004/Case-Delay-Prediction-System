import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, Scale } from 'lucide-react';

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || `Request failed (${response.status})`);
      onAuthenticated(payload);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the account service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-7rem)] grid lg:grid-cols-[1.05fr_.95fr] bg-slate-50 dark:bg-navy-950">
      <section className="hidden lg:flex flex-col justify-between bg-navy-950 text-white p-12 xl:p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-lg bg-gold-500 text-navy-950"><Scale className="w-6 h-6" /></span>
          <span className="font-bold tracking-wide">JUSTICE <span className="text-gold-400">AI</span></span>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs uppercase tracking-[.18em] text-gold-400 font-semibold">Case intelligence workspace</p>
          <h1 className="serif-heading mt-5 text-4xl xl:text-5xl font-bold leading-tight">From filing-time estimate to observed outcome.</h1>
          <p className="mt-5 text-base text-slate-300 leading-relaxed">Keep reviewed case details, predictions, and final outcomes together so you can evaluate estimates against what happened.</p>
        </div>
        <p className="relative text-xs text-slate-400">Local project demo · records are stored in this installation’s SQLite database.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-navy-900 text-gold-400"><Scale className="w-5 h-5" /></span>
            <span className="font-bold text-navy-950 dark:text-white">JUSTICE <span className="text-gold-600">AI</span></span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <LockKeyhole className="w-4 h-4" /> Private case register
          </div>
          <h2 className="serif-heading mt-3 text-3xl font-bold text-navy-950 dark:text-white">
            {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {mode === 'login' ? 'Sign in to review saved cases and outcomes.' : 'Create a local account to start tracking case estimates.'}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="account-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <input id="account-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-3.5 py-3 text-sm text-navy-950 dark:text-white outline-none focus:ring-2 focus:ring-gold-500" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="account-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <input id="account-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 10} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-3.5 py-3 text-sm text-navy-950 dark:text-white outline-none focus:ring-2 focus:ring-gold-500" placeholder={mode === 'login' ? 'Enter your password' : 'At least 10 characters'} />
              {mode === 'register' && <p className="mt-1.5 text-[11px] text-slate-500">Use at least 10 characters.</p>}
            </div>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
            <button disabled={busy} className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-navy-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-navy-800 disabled:opacity-60 dark:bg-gold-500 dark:text-navy-950">
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <button type="button" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }} className="mt-5 text-sm font-semibold text-navy-800 hover:underline dark:text-gold-400">
            {mode === 'login' ? 'Create a new account' : 'I already have an account'}
          </button>

          <p className="mt-8 border-t border-slate-200 dark:border-navy-800 pt-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Demo privacy note: structured case details and evaluation outcomes are stored locally. Do not use real sensitive case records in this demonstration. Uploaded documents and pasted source text are not saved to the case register.
          </p>
        </div>
      </section>
    </main>
  );
}
