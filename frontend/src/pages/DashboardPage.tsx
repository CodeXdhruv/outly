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
  MailCheck,
  Calendar
} from 'lucide-react';
import type { EmailCounts } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = React.useState<number>(7);

  const { data: counts } = useQuery<EmailCounts>({
    queryKey: ['emails', 'counts'],
    queryFn: async () => {
      const res = await fetch('/api/emails/counts');
      if (!res.ok) throw new Error('Failed to fetch counts');
      return res.json();
    },
    refetchInterval: 10000,
  });

  interface ActivityData {
    days: number;
    series: Array<{
      date: string;
      label: string;
      scheduled: number;
      sent: number;
      failed: number;
    }>;
  }

  const { data: activity } = useQuery<ActivityData>({
    queryKey: ['emails', 'activity', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/emails/activity?days=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const scheduledCount = counts?.scheduled ?? 0;
  const sentCount = counts?.sent ?? 0;
  const failedCount = counts?.failed ?? 0;
  const deliveryRate = (sentCount + failedCount) > 0 ? Math.round((sentCount / (sentCount + failedCount)) * 100) : 100;

  const series = activity?.series ?? [];
  const maxVal = Math.max(
    5,
    ...series.map((s) => Math.max(s.scheduled, s.sent, s.failed))
  );

  // SVG Chart Dimensions
  const chartWidth = 800;
  const chartHeight = 200;
  const paddingX = 40;
  const paddingY = 20;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const getPoints = (key: 'scheduled' | 'sent' | 'failed') => {
    if (series.length === 0) return [];
    if (series.length === 1) {
      const y = paddingY + plotHeight - (series[0][key] / maxVal) * plotHeight;
      return [{ x: paddingX + plotWidth / 2, y, val: series[0][key], label: series[0].label }];
    }
    return series.map((item, idx) => {
      const x = paddingX + (idx / (series.length - 1)) * plotWidth;
      const y = paddingY + plotHeight - (item[key] / maxVal) * plotHeight;
      return { x, y, val: item[key], label: item.label };
    });
  };

  const scheduledPoints = getPoints('scheduled');
  const sentPoints = getPoints('sent');
  const failedPoints = getPoints('failed');

  const makePath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = points[idx - 1];
      const cx = (prev.x + curr.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }, '');
  };

  const scheduledPath = makePath(scheduledPoints);
  const sentPath = makePath(sentPoints);
  const failedPath = makePath(failedPoints);

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
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-xs focus:outline-none cursor-pointer"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
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
            <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
              <span>Ready in queue</span>
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
              <span>Delivered successfully</span>
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
              <span>Overall dispatch success</span>
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
              <span>{failedCount === 0 ? 'No delivery failures' : 'Needs attention'}</span>
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
          <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} fill="none">
            {/* Grid lines */}
            <line x1="0" y1={paddingY} x2={chartWidth} y2={paddingY} stroke="#F1F5F9" strokeWidth="1" />
            <line x1="0" y1={paddingY + plotHeight * 0.33} x2={chartWidth} y2={paddingY + plotHeight * 0.33} stroke="#F1F5F9" strokeWidth="1" />
            <line x1="0" y1={paddingY + plotHeight * 0.66} x2={chartWidth} y2={paddingY + plotHeight * 0.66} stroke="#F1F5F9" strokeWidth="1" />
            <line x1="0" y1={paddingY + plotHeight} x2={chartWidth} y2={paddingY + plotHeight} stroke="#F1F5F9" strokeWidth="1" />

            {/* Scheduled Path */}
            {scheduledPath && (
              <path
                d={scheduledPath}
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Sent Path */}
            {sentPath && (
              <path
                d={sentPath}
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Failed Path */}
            {failedPath && (
              <path
                d={failedPath}
                stroke="#EF4444"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Data Points */}
            {scheduledPoints.map((pt, i) => (
              <circle
                key={`sch-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#6366F1"
                stroke="#FFFFFF"
                strokeWidth="2"
              >
                <title>{`${pt.label} Scheduled: ${pt.val}`}</title>
              </circle>
            ))}

            {sentPoints.map((pt, i) => (
              <circle
                key={`sent-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth="2"
              >
                <title>{`${pt.label} Sent: ${pt.val}`}</title>
              </circle>
            ))}

            {failedPoints.map((pt, i) => (
              <circle
                key={`failed-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#EF4444"
                stroke="#FFFFFF"
                strokeWidth="2"
              >
                <title>{`${pt.label} Failed: ${pt.val}`}</title>
              </circle>
            ))}
          </svg>

          {/* Dynamic Date Labels */}
          <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-2 px-2">
            {series.filter((_, idx) => {
              if (series.length <= 7) return true;
              if (series.length <= 30) return idx % 5 === 0 || idx === series.length - 1;
              return idx % 15 === 0 || idx === series.length - 1;
            }).map((s) => (
              <span key={s.date}>{s.label}</span>
            ))}
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
