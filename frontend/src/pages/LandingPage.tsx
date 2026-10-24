import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Mail,
  CheckCircle2
} from 'lucide-react';
import logoSvg from '../assets/reachinbox-blue-favicon.svg';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-indigo-50 selection:text-indigo-900">
      {/* Navigation */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logoSvg}
              alt="ReachInbox"
              className="w-7 h-7 rounded-lg shadow-xs"
            />
            <span className="font-display font-bold text-lg tracking-tight text-slate-900">
              Reach<span className="text-indigo-600">Inbox</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#architecture" className="hover:text-slate-900 transition-colors">Architecture</a>
            <a href="#demo" className="hover:text-slate-900 transition-colors">Queue Demo</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-xs transition-all active:scale-[0.98]"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="pt-24 pb-20 text-center">
          <div className="max-w-4xl mx-auto px-6">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium mb-8">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Production-Grade Distributed Email Dispatch</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-bold text-4xl sm:text-6xl text-slate-900 tracking-tight max-w-3xl mx-auto leading-[1.12]">
              Reliable, high-volume email scheduling at scale.
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
              Accept email send requests via API, queue them with atomic Redis locks, and dispatch through BullMQ workers with persistent crash recovery.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-xs transition-all active:scale-[0.99]"
              >
                <span>Launch Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-200 transition-all"
              >
                <span>Explore Features</span>
              </a>
            </div>

            {/* Minimalist Dashboard Preview Card */}
            <div id="demo" className="mt-16 max-w-4xl mx-auto rounded-xl border border-slate-200/90 shadow-sm overflow-hidden bg-white text-left">
              {/* Window Header */}
              <div className="h-10 bg-slate-50/80 border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  app.reachinbox.ai
                </div>
                <div className="w-10" />
              </div>

              {/* Clean Preview Content */}
              <div className="p-6 bg-slate-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Scheduled Queue</span>
                      <Clock className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display text-slate-900">Active</div>
                    <span className="text-xs text-slate-500 mt-1 inline-block">BullMQ persistent delayed jobs</span>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Rate Limiter</span>
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display text-slate-900">Enforced</div>
                    <span className="text-xs text-slate-500 mt-1 inline-block">Atomic Redis Lua token bucket</span>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Restart Proof</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display text-slate-900">100%</div>
                    <span className="text-xs text-slate-500 mt-1 inline-block">PostgreSQL startup reconciliation</span>
                  </div>
                </div>

                {/* Example Queue Row */}
                <div className="mt-4 bg-white rounded-lg border border-slate-200/80 p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Quarterly Product Roadmap Updates</span>
                      <span className="text-slate-400 ml-2">to alex.morgan@stripe.com</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Dispatched via Ethereal SMTP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section id="features" className="py-20 border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <h2 className="text-2xl font-bold font-display tracking-tight text-slate-900">
                Core System Architecture
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Engineered to handle high-concurrency dispatching without duplicates or dropped tasks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">BullMQ + Redis Delayed Jobs</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Zero cron dependencies. Jobs are enqueued with millisecond delays and processed concurrently by configurable workers.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Atomic Hourly Rate Limits</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Redis Lua scripts enforce global and per-sender caps. When limits are exceeded, jobs defer to the next hour with Slack alerts.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Crash & Restart Recovery</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  PostgreSQL persists every job state. On reboot, idempotent reconciliation re-queues any interrupted emails without duplication.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 text-xs text-slate-500 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logoSvg} alt="ReachInbox" className="w-3.5 h-3.5 rounded" />
            <span className="font-semibold text-slate-700">ReachInbox</span>
            <span>© 2026</span>
          </div>
          <div className="flex gap-5">
            <a href="#features" className="hover:text-slate-800">Architecture</a>
            <Link to="/login" className="hover:text-slate-800">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
