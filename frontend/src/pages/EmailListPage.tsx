import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Star,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { EmailRow } from '../components/EmailRow';
import type { EmailListItem } from '../types';

export const EmailListPage: React.FC<{ mode: 'scheduled' | 'sent' }> = ({ mode }) => {
  const queryClient = useQueryClient();
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

  // Query emails with 10s polling
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top action / search bar */}
      <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-900/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search in ${mode === 'scheduled' ? 'Scheduled' : 'Sent'} emails...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-neutral-800/80 border border-neutral-700/60 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Starred filter button */}
          <button
            onClick={() => {
              setStarredOnly(!starredOnly);
              setPage(1);
            }}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              starredOnly
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'border-neutral-700/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="Filter starred"
          >
            <Star className={`w-4 h-4 ${starredOnly ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Sender Filter */}
          {senders && senders.length > 0 && (
            <select
              value={filterSender}
              onChange={(e) => {
                setFilterSender(e.target.value);
                setPage(1);
              }}
              className="bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-orange-500"
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

        {/* Right side: Refresh & Pagination */}
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          {data && data.total > 0 && (
            <span>
              {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main List content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-neutral-400">
            <RotateCw className="w-6 h-6 animate-spin text-orange-500" />
            <span className="text-sm">Loading emails...</span>
          </div>
        ) : isError ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <span className="text-sm">Failed to load emails: {(error as any)?.message}</span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Inbox className="w-10 h-10 stroke-[1.5]" />
            <p className="text-sm font-medium">No {mode} emails found</p>
            {search && <p className="text-xs">Try clearing search filters</p>}
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {data?.items.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                onToggleStar={(id, cur) => starMutation.mutate({ id, starred: !cur })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
