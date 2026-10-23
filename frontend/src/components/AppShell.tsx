import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  Plus,
  Clock,
  LogOut,
  ShieldCheck,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { EmailCounts, SlackStatus } from '../types';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Email counts query with 10s polling
  const { data: counts } = useQuery<EmailCounts>({
    queryKey: ['emails', 'counts'],
    queryFn: async () => {
      const res = await fetch('/api/emails/counts');
      if (!res.ok) throw new Error('Failed to fetch counts');
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Slack status query
  const { data: slack, refetch: refetchSlack } = useQuery<SlackStatus>({
    queryKey: ['integrations', 'slack'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/slack');
      if (!res.ok) throw new Error('Failed to fetch slack status');
      return res.json();
    },
  });

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    await refetch();
    navigate('/login');
  };

  const handleDisconnectSlack = async () => {
    await fetch('/api/integrations/slack', { method: 'DELETE' });
    await refetchSlack();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand header */}
          <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white shadow-md">
                ONG
              </div>
              <span className="font-semibold text-lg tracking-tight">Outbox</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">v1.0</span>
          </div>

          {/* Primary Action */}
          <div className="p-3">
            <button
              onClick={() => navigate('/compose')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Compose Email</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <NavLink
              to="/scheduled"
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive || location.pathname === '/'
                    ? 'bg-neutral-800 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-orange-400" />
                <span>Scheduled</span>
              </div>
              {counts?.scheduled !== undefined && counts.scheduled > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-mono">
                  {counts.scheduled}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/sent"
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-neutral-800 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Sent</span>
              </div>
              {counts?.sent !== undefined && counts.sent > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                  {counts.sent}
                </span>
              )}
            </NavLink>
          </nav>
        </div>

        {/* User Footer & Menu */}
        <div className="border-t border-neutral-800 p-3 relative">
          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-neutral-900 border border-neutral-750 rounded-xl shadow-2xl p-2 text-sm z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-neutral-800">
                <p className="font-medium text-neutral-200 truncate">{user?.name}</p>
                <p className="text-xs text-neutral-400 truncate font-mono">{user?.email}</p>
              </div>

              {/* Slack Integration Row */}
              <div className="p-2 border-b border-neutral-800">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-neutral-300 font-medium text-xs">
                    <MessageSquare className="w-3.5 h-3.5 text-[#ECB22E]" />
                    <span>Slack Alerts</span>
                  </div>
                  {slack?.connected ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                      Off
                    </span>
                  )}
                </div>

                {slack?.connected ? (
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-neutral-400 truncate max-w-[120px]">
                      {slack.channel ? `#${slack.channel}` : slack.teamName}
                    </span>
                    <button
                      onClick={handleDisconnectSlack}
                      className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <a
                    href="/integrations/slack/connect"
                    className="block text-center mt-1 py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-750 text-xs text-neutral-300 transition-colors"
                  >
                    Connect Slack
                  </a>
                )}
              </div>

              {/* Bull Board Admin link if admin */}
              {user?.isAdmin && (
                <a
                  href="/admin/queues"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors text-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Bull Board Queues</span>
                </a>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-xs cursor-pointer mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-neutral-800/60 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-neutral-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {user?.name?.[0] || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-200 truncate">{user?.name}</p>
                <p className="text-[11px] text-neutral-400 truncate font-mono">{user?.email}</p>
              </div>
            </div>
            <ChevronUp
              className={`w-4 h-4 text-neutral-400 transition-transform ${
                userMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-neutral-950">
        {children}
      </main>
    </div>
  );
};
