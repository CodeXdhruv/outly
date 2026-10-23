import React from 'react';
import type { EmailListItem } from '../types';

export const StatusPill: React.FC<{
  status: EmailListItem['status'];
  deferred: boolean;
}> = ({ status, deferred }) => {
  if (deferred) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
        Deferred
      </span>
    );
  }

  switch (status) {
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono">
          Scheduled
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 animate-pulse font-mono">
          Sending...
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
          Sent
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono">
          Failed
        </span>
      );
    default:
      return null;
  }
};
