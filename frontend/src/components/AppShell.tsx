import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Clock,
  LogOut,
  LayoutDashboard,
  CheckCircle2,
  Sliders,
  Search,
  Bell,
  ChevronDown
} from 'lucide-react';
import logoSvg from '../assets/reachinbox-blue-favicon.svg';
import { useAuth } from '../hooks/useAuth';
import type { EmailCounts } from '../types';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

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

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    await refetch();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Compose', path: '/compose', icon: Plus },
    { label: 'Scheduled', path: '/scheduled', icon: Clock, count: counts?.scheduled },
    { label: 'Sent', path: '/sent', icon: CheckCircle2, count: counts?.sent },
    { label: 'Settings', path: '/settings', icon: Sliders },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand header */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <img
                src={logoSvg}
                alt="ReachInbox"
                className="w-8 h-8 rounded-lg shadow-sm shadow-indigo-500/20"
              />
              <span className="font-display font-bold text-lg tracking-tight text-slate-900">
                Reach<span className="text-indigo-600">Inbox</span>
              </span>
            </NavLink>
          </div>

          {/* Nav links */}
          <nav className="p-3.5 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-[14px]">{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                        isActive
                          ? 'bg-indigo-200/70 text-indigo-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-slate-100 relative">
          <div 
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user?.name?.[0] || user?.email?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.name || 'Alex Johnson'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'alex@company.com'}
                </p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Dropdown Menu */}
          {userDropdownOpen && (
            <div className="absolute bottom-16 left-3 right-3 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 space-y-1 z-50">
              <button
                onClick={() => {
                  setUserDropdownOpen(false);
                  navigate('/settings');
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with Search and Notifications */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-8 flex items-center justify-between shrink-0">
          <div className="relative w-72 sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search emails, recipients..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/scheduled?search=${encodeURIComponent((e.target as any).value)}`);
                }
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute top-2 right-2" />
            </button>
          </div>
        </header>

        {/* View body */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
