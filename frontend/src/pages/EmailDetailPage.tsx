import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  Clock,
  Paperclip,
  Download,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { StatusPill } from '../components/StatusPill';
import type { EmailDetail } from '../types';

export const EmailDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: email, isLoading, isError, error } = useQuery<EmailDetail>({
    queryKey: ['email', id],
    queryFn: async () => {
      const res = await fetch(`/api/emails/${id}`);
      if (!res.ok) throw new Error('Email not found');
      return res.json();
    },
  });

  const sanitizedHtml = React.useMemo(() => {
    if (!email?.bodyHtml) return '';
    return DOMPurify.sanitize(email.bodyHtml);
  }, [email?.bodyHtml]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        <RotateCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isError || !email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-400">
        <p className="text-sm">{(error as any)?.message || 'Failed to load email'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-white"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">{email.subject}</h1>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">ID: {email.id}</p>
          </div>
        </div>

        <StatusPill status={email.status} deferred={email.deferred} />
      </div>

      {/* Email Meta & Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-4xl">
        {/* Error message banner if any */}
        {email.errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">Delivery Failure</p>
              <p className="text-xs mt-1">{email.errorMessage}</p>
              <p className="text-[11px] text-rose-400/80 mt-1">Attempts made: {email.attemptCount}</p>
            </div>
          </div>
        )}

        {/* Sender / Recipient Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">From:</span>
              <span className="font-medium text-white">{email.senderEmail}</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {new Date(email.sentAt || email.scheduledAt).toLocaleString('en-US', {
                  timeZone: 'UTC',
                  dateStyle: 'medium',
                  timeStyle: 'medium',
                })}{' '}
                UTC
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">To:</span>
            <span className="font-medium text-orange-400">{email.recipientEmail}</span>
          </div>
        </div>

        {/* Body HTML */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 min-h-[200px]">
          <div
            className="prose prose-invert prose-sm max-w-none text-neutral-200"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </div>

        {/* Attachments Section */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              <span>Attachments ({email.attachments.length})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {email.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/api/attachments/${att.id}`}
                  download={att.filename}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors group cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-neutral-200 truncate group-hover:text-orange-400">
                      {att.filename}
                    </p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                      {(att.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-neutral-500 group-hover:text-neutral-200 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
