import React from 'react';
import { Star } from 'lucide-react';
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
      className="group flex items-center gap-4 px-4 py-3 border-b border-neutral-800/80 hover:bg-neutral-800/40 cursor-pointer transition-colors"
    >
      {/* Star button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(email.id, email.starred);
        }}
        className="p-1 text-neutral-500 hover:text-amber-400 focus:outline-none transition-colors"
      >
        <Star
          className={`w-4 h-4 ${
            email.starred ? 'fill-amber-400 text-amber-400' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        />
      </button>

      {/* Recipient */}
      <div className="w-48 shrink-0 truncate">
        <span className="text-sm font-medium text-neutral-200">{email.recipientEmail}</span>
      </div>

      {/* Subject + Preview */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-100 truncate shrink-0 max-w-xs">
          {email.subject}
        </span>
        <span className="text-neutral-500 text-xs">-</span>
        <span className="text-xs text-neutral-400 truncate">{email.preview}</span>
      </div>

      {/* Status Pill */}
      <div className="shrink-0">
        <StatusPill status={email.status} deferred={email.deferred} />
      </div>

      {/* Date */}
      <div className="w-32 shrink-0 text-right text-xs text-neutral-400 font-mono">
        {formattedDate}
      </div>
    </div>
  );
};
