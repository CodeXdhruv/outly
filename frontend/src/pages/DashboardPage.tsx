import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  Plus,
  TrendingUp,
  MailCheck,
  Calendar
} from 'lucide-react';
import type { EmailCounts } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: counts } = useQuery<EmailCounts>({
    queryKey: ['emails', 'counts'],
    queryFn: async () => {
      const res = await fetch('/api/emails/counts');
      if (!res.ok) throw new Error('Failed to fetch counts');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const scheduledCount = counts?.scheduled ?? 0;
  const sentCount = counts?.sent ?? 0;
  const failedCount = 0;
  const total = scheduledCount + sentCount + failedCount;
  const deliveryRate = (sentCount + failedCount) > 0 ? Math.round((sentCount / (sentCount + failedCount)) * 100) : 100;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening with your cold outreach campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-xs focus:outline-none cursor-pointer">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>All time</option>
          </select>
          <button
            onClick={() => navigate('/compose')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Scheduled Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Scheduled</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-display text-slate-900 tracking-tight">
              {scheduledCount}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12% from last week</span>
            </div>
          </div>
        </div>

        {/* Sent Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Sent</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-display text-slate-900 tracking-tight">
              {sentCount}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18% from last week</span>
            </div>
          </div>
        </div>

        {/* Delivery / Opened Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Delivery Rate</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <MailCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-display text-slate-900 tracking-tight">
              {deliveryRate}%
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+6% from last week</span>
            </div>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-100 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Failed / Bounced</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold font-display text-slate-900 tracking-tight">
              {failedCount}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <span>-4% from last week</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">Email Activity</h2>
            <p className="text-xs text-slate-500">Volume across scheduled, sent, and failed deliveries</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Scheduled
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sent
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Failed
            </span>
          </div>
        </div>

        <div className="h-64 w-full relative">
          <svg className="w-full h-full" viewBox="0 0 800 240" fill="none">
            <line x1="0" y1="200" x2="800" y2="200" stroke="#F1F5F9" strokeWidth="1" />
            <line x1="0" y1="150" x2="800" y2="150" stroke="#F1F5F9" strokeWidth="1" />
            <line x1="0" y1="100" x2="800" y2="100" stroke="#F1F5F9" strokeWidth="1" />
            <line x1="0" y1="50" x2="800" y2="50" stroke="#F1F5F9" strokeWidth="1" />

            <path
              d="M 50 180 C 150 160, 250 80, 400 90 C 550 100, 650 40, 750 60"
              stroke="#6366F1"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M 50 195 C 150 185, 250 130, 400 120 C 550 110, 650 70, 750 85"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 50 220 C 150 215, 250 210, 400 200 C 550 205, 650 190, 750 195"
              stroke="#EF4444"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />

            <circle cx="400" cy="90" r="4" fill="#6366F1" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="750" cy="60" r="4" fill="#6366F1" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="400" cy="120" r="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="750" cy="85" r="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
          </svg>

          <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-2 px-4">
            <span>Jun 10</span>
            <span>Jun 11</span>
            <span>Jun 12</span>
            <span>Jun 13</span>
            <span>Jun 14</span>
            <span>Jun 15</span>
            <span>Jun 16</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div 
          onClick={() => navigate('/scheduled')}
          className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Manage Scheduled Queue</h3>
              <p className="text-xs text-slate-500">Inspect upcoming email batches and delivery pacing</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400" />
        </div>

        <div 
          onClick={() => navigate('/sent')}
          className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">View Sent Outbox</h3>
              <p className="text-xs text-slate-500">Audit delivered emails, recipient status, and timestamps</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
};
