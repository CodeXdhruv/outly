import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, X, AlertCircle } from 'lucide-react';
import { RecipientInput } from '../components/RecipientInput';
import { RichEditor } from '../components/RichEditor';
import { SendLaterPopover } from '../components/SendLaterPopover';
import { ConfirmSendDialog } from '../components/ConfirmSendDialog';
import type { Sender } from '../types';

export const ComposePage: React.FC = () => {
  const navigate = useNavigate();

  // Stable idempotency key for this compose session
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());

  // Form State
  const [senderId, setSenderId] = React.useState('');
  const [recipients, setRecipients] = React.useState<string[]>([]);
  const [subject, setSubject] = React.useState('');
  const [bodyHtml, setBodyHtml] = React.useState('');
  const [delaySeconds, setDelaySeconds] = React.useState(2);
  const [hourlyLimit, setHourlyLimit] = React.useState(100);

  // Attachments state
  const [attachments, setAttachments] = React.useState<
    Array<{ id: string; filename: string; size: number }>
  >([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = React.useState(false);
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);

  // Confirmation dialog & submission
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [scheduledDate, setScheduledDate] = React.useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Fetch Senders
  const { data: senders } = useQuery<Sender[]>({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await fetch('/api/senders');
      if (!res.ok) throw new Error('Failed to load senders');
      return res.json();
    },
  });

  // Set default sender
  React.useEffect(() => {
    if (senders && senders.length > 0 && !senderId) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (attachments.length >= 3) {
      alert('Maximum 3 attachments per campaign allowed.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Attachment size cannot exceed 2 MB.');
      return;
    }

    setIsUploadingAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error?.message || 'Attachment upload failed');
        return;
      }

      const data = await res.json();
      setAttachments((prev) => [...prev, data]);
    } catch {
      alert('Network error uploading attachment');
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenConfirm = (targetDate: Date) => {
    if (recipients.length === 0) {
      alert('Please add at least one recipient.');
      return;
    }
    if (!subject.trim()) {
      alert('Please enter an email subject.');
      return;
    }
    setScheduledDate(targetDate);
    setConfirmOpen(true);
  };

  const handleExecuteSend = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          senderId,
          recipients,
          subject,
          bodyHtml,
          startAt: scheduledDate.toISOString(),
          delaySeconds: Number(delaySeconds),
          hourlyLimit: Number(hourlyLimit),
          attachmentIds: attachments.map((a) => a.id),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error?.message || 'Failed to schedule campaign');
        setIsSubmitting(false);
        return;
      }

      await res.json();
      setConfirmOpen(false);
      navigate('/scheduled');
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error scheduling campaign');
      setIsSubmitting(false);
    }
  };

  const selectedSenderEmail =
    senders?.find((s) => s.id === senderId)?.fromEmail || 'Loading...';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white tracking-tight">Compose Campaign</h1>
        <div className="text-xs text-neutral-400 font-mono">
          Key: {idempotencyKey.slice(0, 8)}...
        </div>
      </div>

      {/* Main Form */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-5">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sender Dropdown */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-400">From Sender</label>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 focus:outline-none focus:border-orange-500"
          >
            {senders?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fromEmail}
              </option>
            ))}
          </select>
        </div>

        {/* Recipients Input */}
        <RecipientInput recipients={recipients} onChange={setRecipients} />

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-400">Subject</label>
          <input
            type="text"
            placeholder="Campaign subject line..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Pacing & Rate Limit Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">
              Delay Between Emails (seconds)
            </label>
            <input
              type="number"
              min="0"
              max="3600"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-orange-500 font-mono"
            />
            <p className="text-[11px] text-neutral-500">Paces sends to avoid spam triggers.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">
              Hourly Limit per Sender
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-neutral-100 focus:outline-none focus:border-orange-500 font-mono"
            />
            <p className="text-[11px] text-neutral-500">Jobs exceeding cap defer to next hour.</p>
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-400">Email Body</label>
          <RichEditor value={bodyHtml} onChange={setBodyHtml} />
        </div>

        {/* Attachments Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-neutral-400">
              Attachments ({attachments.length}/3)
            </label>
            <button
              type="button"
              disabled={attachments.length >= 3 || isUploadingAttachment}
              onClick={() => attachmentInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>{isUploadingAttachment ? 'Uploading...' : 'Add Attachment'}</span>
            </button>
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv"
              onChange={handleAttachmentUpload}
              className="hidden"
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                >
                  <span className="truncate max-w-[150px]">{att.filename}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    ({(att.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="pt-4 flex items-center justify-end border-t border-neutral-800">
          <SendLaterPopover
            disabled={isSubmitting}
            onSendNow={() => handleOpenConfirm(new Date())}
            onSchedule={(date) => handleOpenConfirm(date)}
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmSendDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecuteSend}
        isSubmitting={isSubmitting}
        summary={{
          senderEmail: selectedSenderEmail,
          recipientCount: recipients.length,
          subject,
          scheduledAt: scheduledDate,
          delaySeconds,
          hourlyLimit,
          attachmentCount: attachments.length,
        }}
      />
    </div>
  );
};
