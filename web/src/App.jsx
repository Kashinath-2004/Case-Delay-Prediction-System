import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import CaseAnalysis from './pages/CaseAnalysis';
import Predict from './pages/Predict';
import HowItWorks from './pages/HowItWorks';
import Results from './pages/Results';
import Robustness from './pages/Robustness';
import Auth from './pages/Auth';
import CaseRegister from './pages/CaseRegister';

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [session, setSession] = useState(null);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('justice_ai_session');
    if (!savedToken) {
      setSessionChecking(false);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then((response) => {
        if (!response.ok) throw new Error('Session expired');
        return response.json();
      })
      .then((user) => setSession({ access_token: savedToken, user }))
      .catch(() => window.localStorage.removeItem('justice_ai_session'))
      .finally(() => setSessionChecking(false));
  }, []);

  const handleAuthenticated = (newSession) => {
    window.localStorage.setItem('justice_ai_session', newSession.access_token);
    setSession(newSession);
    setActivePage('home');
  };

  const handleSignOut = async () => {
    if (session?.access_token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
    window.localStorage.removeItem('justice_ai_session');
    setSession(null);
  };

  if (sessionChecking) {
    return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Checking your local session…</main>;
  }

  if (!session) {
    return <div className="min-h-screen bg-slate-50 dark:bg-navy-950"><Auth onAuthenticated={handleAuthenticated} /></div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-navy-950 transition-colors">
      <Navbar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        user={session.user}
        onSignOut={handleSignOut}
      />

      <main className="flex-grow">
        {activePage === 'home' && <Home setActivePage={setActivePage} />}
        {activePage === 'analyze' && <CaseAnalysis token={session.access_token} />}
        {activePage === 'cases' && <CaseRegister token={session.access_token} />}
        {activePage === 'predict' && <Predict />}
        {activePage === 'how-it-works' && <HowItWorks />}
        {activePage === 'results' && <Results />}
        {activePage === 'robustness' && <Robustness />}
      </main>

      <Footer />
    </div>
  );
}

