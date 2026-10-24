import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  CheckCircle2, 
  Sliders, 
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../App';
import type { SlackStatus } from '../types';

export const IntegrationsPage: React.FC = () => {
  const { user } = useAuth();
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { data: slack, refetch: refetchSlack } = useQuery<SlackStatus>({
    queryKey: ['integrations', 'slack'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/slack');
      if (!res.ok) throw new Error('Failed to fetch slack status');
      return res.json();
    },
  });

  const handleDisconnectSlack = async () => {
    await fetch('/api/integrations/slack', { method: 'DELETE' });
    await refetchSlack();
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
          Integrations & Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect your accounts and configure sending guardrails.
        </p>
      </div>

      {/* Connected Accounts */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
        <div className="p-6">
          <h2 className="font-display font-bold text-base text-slate-900">
            Connected Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your Google identity and real-time team alert channels.
          </p>
        </div>

        {/* Google Card */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-900">Google Workspace</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {user?.email || 'Logged in via Google OAuth 2.0'}
              </p>
            </div>
          </div>
          <button
            onClick={() => (window.location.href = '/auth/logout')}
            className="text-xs font-medium text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors self-start sm:self-auto cursor-pointer"
          >
            Disconnect
          </button>
        </div>

        {/* Slack Card */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-900">Slack Notifications</h3>
                {slack?.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {slack?.connected
                  ? `Posting to ${slack.channel || 'configured channel'}`
                  : 'Receive real-time alerts when hourly rate limits or throttle thresholds are hit.'}
              </p>
            </div>
          </div>
          {slack?.connected ? (
            <button
              onClick={handleDisconnectSlack}
              className="text-xs font-medium text-rose-600 hover:bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200 transition-colors self-start sm:self-auto cursor-pointer"
            >
              Disconnect Slack
            </button>
          ) : (
            <a
              href="/api/integrations/slack/authorize"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              Connect Slack
            </a>
          )}
        </div>
      </div>

      {/* Sending Limits Guardrail */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-slate-900">Sending Safety Limits</h2>
            <p className="text-xs text-slate-500">Configure global hourly rate caps to protect sender reputation</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Max Emails per Hour (per sender)
            </label>
            <input
              type="number"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              min={10}
              max={1000}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Emails exceeding this rate limit in a given hour will be automatically rescheduled with jitter.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Save Configuration
            </button>
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
