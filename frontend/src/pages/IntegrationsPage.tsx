import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  CheckCircle2, 
  Sliders, 
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Send,
  Users,
  Gauge,
  Loader2
} from 'lucide-react';
import { useAuth } from '../App';
import type { SlackStatus, SystemSettings } from '../types';

export const IntegrationsPage: React.FC = () => {
  const { user } = useAuth();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for sending settings
  const [maxEmailsPerHourPerSender, setMaxEmailsPerHourPerSender] = useState(100);
  const [maxEmailsPerHourGlobal, setMaxEmailsPerHourGlobal] = useState(200);
  const [minDelayBetweenSendsMs, setMinDelayBetweenSendsMs] = useState(2000);
  const [maxRecipients, setMaxRecipients] = useState(5000);

  const { data: slack, refetch: refetchSlack } = useQuery<SlackStatus>({
    queryKey: ['integrations', 'slack'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/slack');
      if (!res.ok) throw new Error('Failed to fetch slack status');
      return res.json();
    },
  });

  const { data: settings, isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery<SystemSettings>({
    queryKey: ['settings', 'system'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch sending settings');
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setMaxEmailsPerHourPerSender(settings.maxEmailsPerHourPerSender);
      setMaxEmailsPerHourGlobal(settings.maxEmailsPerHourGlobal);
      setMinDelayBetweenSendsMs(settings.minDelayBetweenSendsMs);
      setMaxRecipients(settings.maxRecipients);
    }
  }, [settings]);

  const handleDisconnectSlack = async () => {
    await fetch('/api/integrations/slack', { method: 'DELETE' });
    await refetchSlack();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.isAdmin) {
      setErrorMessage('Admin privileges required to modify sending rate limits.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxEmailsPerHourPerSender,
          maxEmailsPerHourGlobal,
          minDelayBetweenSendsMs,
          maxRecipients,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to update system settings');
      }

      await refetchSettings();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
          Integrations & Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect your accounts and configure sending guardrails and rate limits.
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
                {user?.isAdmin && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                )}
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
            <button
              onClick={() => {
                const ticket = localStorage.getItem('auth_ticket');
                window.location.href = `/integrations/slack/connect${ticket ? `?auth_ticket=${ticket}` : ''}`;
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              Connect Slack
            </button>
          )}
        </div>
      </div>

      {/* Sending Limits Guardrail & Rate Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-base text-slate-900">Mail Dispatch & Pacing Settings</h2>
                {user?.isAdmin ? (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin Configurable
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> View Only (Admin Required)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Live worker throttles: controls dispatch pace, hourly caps, and batch limits across all campaigns.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoadingSettings ? (
          <div className="py-8 flex items-center justify-center text-xs text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            Loading live sending policies...
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Max Emails per hour per sender */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                    Hourly Limit (Per Sender)
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">emails / hr</span>
                </div>
                <input
                  type="number"
                  disabled={!user?.isAdmin}
                  value={maxEmailsPerHourPerSender}
                  onChange={(e) => setMaxEmailsPerHourPerSender(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hard ceiling for any single sender address per UTC hour. Excess emails defer automatically.
                </p>
              </div>

              {/* Global max emails per hour */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                    Global Hourly Cap (All Senders)
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">emails / hr</span>
                </div>
                <input
                  type="number"
                  disabled={!user?.isAdmin}
                  value={maxEmailsPerHourGlobal}
                  onChange={(e) => setMaxEmailsPerHourGlobal(Number(e.target.value))}
                  min={1}
                  max={50000}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Total system-wide throughput limit across all active senders and concurrent campaigns combined.
                </p>
              </div>

              {/* Minimum delay between consecutive emails */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Minimum Dispatch Delay
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">milliseconds</span>
                </div>
                <input
                  type="number"
                  disabled={!user?.isAdmin}
                  value={minDelayBetweenSendsMs}
                  onChange={(e) => setMinDelayBetweenSendsMs(Number(e.target.value))}
                  min={500}
                  max={60000}
                  step={100}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Enforces spacing between emails from the same sender (e.g. 2000ms = 2s delay) to avoid anti-spam bans.
                </p>
              </div>

              {/* Max recipients per campaign */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Max Recipients Per Campaign
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">recipients</span>
                </div>
                <input
                  type="number"
                  disabled={!user?.isAdmin}
                  value={maxRecipients}
                  onChange={(e) => setMaxRecipients(Number(e.target.value))}
                  min={10}
                  max={50000}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Safety ceiling on how many leads can be uploaded or scheduled in a single campaign batch.
                </p>
              </div>
            </div>

            {user?.isAdmin ? (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSaving ? 'Saving Policy...' : 'Save Sending Settings'}
                </button>
                {savedSuccess && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4" /> Changes saved & applied immediately to queue workers!
                  </span>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
                You are currently viewing these parameters with member permissions. Contact an admin to request policy changes.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

