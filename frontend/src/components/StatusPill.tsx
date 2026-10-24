import React from 'react';
import type { EmailListItem } from '../types';

export const StatusPill: React.FC<{
  status: EmailListItem['status'];
  deferred: boolean;
}> = ({ status, deferred }) => {
  if (deferred) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        Deferred
      </span>
    );
  }

  switch (status) {
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          Scheduled
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 animate-pulse">
          Sending...
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Sent
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          Failed
        </span>
      );
    default:
      return null;
  }
};
