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
      {/* Clean Navigation without center links */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
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
            </div>

            {/* Minimalist Dashboard Preview Card */}
            <div className="mt-16 max-w-4xl mx-auto rounded-xl border border-slate-200/90 shadow-sm overflow-hidden bg-white text-left">
              {/* Window Header with Red/Yellow/Green macOS window dots */}
              <div className="h-10 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/40 shadow-xs" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/40 shadow-xs" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/40 shadow-xs" />
                </div>
                <div className="text-[11px] text-slate-500 font-mono bg-white px-3 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                  app.reachinbox.ai/scheduler
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>worker: online</span>
                </div>
              </div>

              {/* Clean Preview Content */}
              <div className="p-6 bg-slate-50/40 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled Queue</span>
                      <Clock className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display text-slate-900">Active</div>
                    <span className="text-xs text-slate-500 mt-1 inline-block">BullMQ persistent delayed jobs</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rate Limiter</span>
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display text-slate-900">Enforced</div>
                    <span className="text-xs text-slate-500 mt-1 inline-block">Atomic Redis Lua token bucket</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Restart Proof</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display text-slate-900">100%</div>
                    <span className="text-xs text-slate-500 mt-1 inline-block">PostgreSQL startup reconciliation</span>
                  </div>
                </div>

                {/* Live Queue Items Demo */}
                <div className="space-y-2">
                  <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex items-center justify-between text-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-900">Quarterly Product Roadmap Updates</span>
                        <span className="text-slate-400 ml-2">to alex.morgan@stripe.com</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium shrink-0 ml-3">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Dispatched via SMTP</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex items-center justify-between text-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-900">Partnership Proposal: Outreach Automation</span>
                        <span className="text-slate-400 ml-2">to partnerships@slack.com</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-600 font-medium shrink-0 ml-3 bg-indigo-50 px-2.5 py-0.5 rounded-full font-mono text-[11px]">
                      <span>scheduled in 4m 12s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 text-xs text-slate-500 bg-white">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logoSvg} alt="ReachInbox" className="w-3.5 h-3.5 rounded" />
            <span className="font-semibold text-slate-700">ReachInbox</span>
            <span>© 2026</span>
          </div>
          <div className="flex gap-5">
            <Link to="/login" className="hover:text-slate-800">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
