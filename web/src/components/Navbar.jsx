import React from 'react';
import { Scale, Activity, Cpu, Award, ShieldCheck, Sun, Moon, ClipboardList, LogOut } from 'lucide-react';

export default function Navbar({ activePage, setActivePage, darkMode, setDarkMode, user, onSignOut }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Scale },
    { id: 'analyze', label: 'Case Analysis', icon: Activity },
    { id: 'cases', label: 'Case Register', icon: ClipboardList },
    { id: 'predict', label: 'Manual Predict', icon: Cpu },
    { id: 'how-it-works', label: 'How It Works', icon: Cpu },
    { id: 'results', label: 'Benchmarks', icon: Award },
    { id: 'robustness', label: 'Audits', icon: ShieldCheck },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-navy-900/80 border-b border-slate-200 dark:border-navy-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div 
            onClick={() => setActivePage('home')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-navy-800 to-navy-950 dark:from-gold-600 dark:to-gold-500 flex items-center justify-center text-gold-400 dark:text-navy-950 shadow-md group-hover:scale-105 transition-transform">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="serif-heading font-bold text-xl text-navy-900 dark:text-white tracking-tight">
                JUSTICE <span className="text-gold-600 dark:text-gold-400">AI</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
                Pendency Predictor
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <div className="hidden md:flex space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-navy-900 text-white dark:bg-gold-500/10 dark:text-gold-400 border border-transparent dark:border-gold-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-gold-400' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dark mode toggle */}
          <div className="flex items-center space-x-2">
            <span className="hidden xl:inline max-w-36 truncate text-xs text-slate-500 dark:text-slate-400" title={user?.email}>{user?.email}</span>
            <button
              onClick={onSignOut}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="w-5 h-5 text-gold-400" /> : <Moon className="w-5 h-5 text-navy-800" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile nav bar */}
      <div className="flex md:hidden overflow-x-auto px-4 py-2 border-t border-slate-200 dark:border-navy-800 space-x-2 bg-slate-50 dark:bg-navy-950">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium ${
                isActive
                  ? 'bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

