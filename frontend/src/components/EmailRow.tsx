import React from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EmailListItem } from '../types';
import { StatusPill } from './StatusPill';

export const EmailRow: React.FC<{
  email: EmailListItem;
  onToggleStar: (id: string, current: boolean) => void;
}> = ({ email, onToggleStar }) => {
  const navigate = useNavigate();

  const formattedDate = React.useMemo(() => {
    const raw = email.sentAt || email.scheduledAt;
    const date = new Date(raw);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [email.scheduledAt, email.sentAt]);

  return (
    <div
      onClick={() => navigate(`/emails/${email.id}`)}
      className="group flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
    >
      {/* Star button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(email.id, email.starred);
        }}
        className="p-1 text-slate-300 hover:text-amber-400 focus:outline-none transition-colors"
      >
        <Star
          className={`w-4 h-4 ${
            email.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-slate-400'
          }`}
        />
      </button>

      {/* Recipient */}
      <div className="w-48 shrink-0 truncate">
        <span className="text-xs font-semibold text-slate-900">{email.recipientEmail}</span>
      </div>

      {/* Subject + Preview */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-800 truncate shrink-0 max-w-xs">
          {email.subject}
        </span>
        <span className="text-slate-300 text-xs">-</span>
        <span className="text-xs text-slate-400 truncate">{email.preview}</span>
      </div>

      {/* Status Pill */}
      <div className="shrink-0">
        <StatusPill status={email.status} deferred={email.deferred} />
      </div>

      {/* Date */}
      <div className="w-32 shrink-0 text-right text-xs text-slate-400 font-mono">
        {formattedDate}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
    </div>
  );
};
