import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  Paperclip,
  Download,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { StatusPill } from '../components/EmailRow';
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
      <div className="flex-1 flex items-center justify-center p-16 text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isError || !email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-16 text-slate-500">
        <p className="text-sm">{(error as any)?.message || 'Failed to load email'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-900 tracking-tight">
              {email.subject}
            </h1>
            <span className="text-xs text-slate-500 font-mono">Job ID: {email.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill status={email.status} deferred={email.deferred} />
        </div>
      </div>

      {/* Meta Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Recipient</span>
            <span className="font-semibold text-slate-900 font-mono">{email.recipientEmail}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Sender</span>
            <span className="font-semibold text-slate-900 font-mono">{email.senderEmail}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Scheduled At (UTC)</span>
            <span className="font-mono text-slate-700">{new Date(email.scheduledAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Sent At (UTC)</span>
            <span className="font-mono text-slate-700">
              {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Pending'}
            </span>
          </div>
        </div>

        {email.errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{email.errorMessage}</span>
          </div>
        )}
      </div>

      {/* Email Body Content */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Email Content
        </h2>
        <div
          className="prose prose-slate text-sm max-w-none text-slate-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 block mb-3">
              Attachments ({email.attachments.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/api/attachments/${att.id}/download`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  <span>{att.filename}</span>
                  <Download className="w-3.5 h-3.5 text-slate-400 ml-1" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
