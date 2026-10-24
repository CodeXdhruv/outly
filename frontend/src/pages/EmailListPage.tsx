import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Star,
  Inbox,
  AlertCircle,
  Plus
} from 'lucide-react';
import { EmailRow } from '../components/EmailRow';
import type { EmailListItem } from '../types';

export const EmailListPage: React.FC<{ mode: 'scheduled' | 'sent' }> = ({ mode }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [filterSender, setFilterSender] = React.useState('');

  const limit = 20;

  // Senders list
  const { data: senders } = useQuery<Array<{ id: string; fromEmail: string }>>({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await fetch('/api/senders');
      if (!res.ok) throw new Error('Failed to fetch senders');
      return res.json();
    },
  });

  // Query emails with 10s polling, staleTime and smooth caching
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    items: EmailListItem[];
    page: number;
    limit: number;
    total: number;
  }>({
    queryKey: ['emails', mode, page, search, starredOnly, filterSender],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: mode,
        page: String(page),
        limit: String(limit),
      });

      if (search) params.set('search', search);
      if (starredOnly) params.set('starred', 'true');
      if (filterSender) params.set('senderId', filterSender);

      const res = await fetch(`/api/emails?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch emails');
      return res.json();
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });

  // Toggle star mutation
  const starMutation = useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      const res = await fetch(`/api/emails/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred }),
      });
      if (!res.ok) throw new Error('Failed to toggle star');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / limit));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Title & Compose CTA Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight capitalize">
            {mode === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'scheduled'
              ? 'View and manage your upcoming email campaigns.'
              : 'Audit all successfully dispatched outreach messages.'}
          </p>
        </div>
        <button
          onClick={() => navigate('/compose')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Compose New Email</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Filter / Toolbar Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3 w-full sm:max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by subject, recipient or campaign..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Starred filter button */}
            <button
              onClick={() => {
                setStarredOnly(!starredOnly);
                setPage(1);
              }}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                starredOnly
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              title="Filter starred"
            >
              <Star className={`w-4 h-4 ${starredOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            {/* Senders Dropdown */}
            {senders && senders.length > 0 && (
              <select
                value={filterSender}
                onChange={(e) => {
                  setFilterSender(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Senders</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fromEmail}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Right Refresh + Pagination info */}
          <div className="flex items-center gap-3 text-xs text-slate-500 w-full sm:w-auto justify-end">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {data && data.total > 0 && (
              <span className="font-mono">
                {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
              </span>
            )}

            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div>
          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="w-5 h-5 bg-slate-200 rounded-md shrink-0" />
                  <div className="w-44 h-4 bg-slate-200 rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-3/4 h-4 bg-slate-200 rounded-md" />
                    <div className="w-1/2 h-3 bg-slate-100 rounded-md" />
                  </div>
                  <div className="w-20 h-6 bg-slate-100 rounded-full shrink-0" />
                  <div className="w-24 h-4 bg-slate-100 rounded-md shrink-0" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <span className="text-xs">Failed to load emails: {(error as any)?.message}</span>
              <button
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Inbox className="w-10 h-10 stroke-[1.2]" />
              <p className="text-sm font-semibold text-slate-700">No {mode} emails found</p>
              <p className="text-xs text-slate-400">Your {mode} campaigns will appear here once scheduled.</p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="flex items-center gap-4 px-6 py-2.5 bg-slate-50/60 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="w-6" />
                <div className="w-48">Recipient</div>
                <div className="flex-1">Subject & Preview</div>
                <div className="w-24">Status</div>
                <div className="w-32 text-right">Time</div>
                <div className="w-4" />
              </div>

              {/* Rows */}
              <div>
                {data?.items.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    onToggleStar={(id, cur) => starMutation.mutate({ id, starred: !cur })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
