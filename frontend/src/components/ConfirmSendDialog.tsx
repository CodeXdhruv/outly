import React from 'react';

interface ConfirmSendDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  summary: {
    senderEmail: string;
    recipientCount: number;
    subject: string;
    scheduledAt: Date;
    delaySeconds: number;
    hourlyLimit: number;
    attachmentCount: number;
  };
}

export const ConfirmSendDialog: React.FC<ConfirmSendDialogProps> = ({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  summary,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Confirm Campaign Schedule</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Review campaign details before scheduling BullMQ delayed jobs.
          </p>
        </div>

        <div className="space-y-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800/80 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">From Sender:</span>
            <span className="font-medium text-white truncate max-w-[200px]">{summary.senderEmail}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Total Recipients:</span>
            <span className="font-semibold text-orange-400">{summary.recipientCount} emails</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Subject:</span>
            <span className="font-medium text-neutral-200 truncate max-w-[200px]">{summary.subject}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Start Time:</span>
            <span className="font-mono text-neutral-200">
              {summary.scheduledAt.toLocaleString('en-US', {
                timeZone: 'UTC',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              UTC
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Pacing Delay:</span>
            <span className="font-medium text-neutral-200">{summary.delaySeconds} seconds between sends</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Hourly Rate Cap:</span>
            <span className="font-medium text-neutral-200">{summary.hourlyLimit} / hour</span>
          </div>

          {summary.attachmentCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Attachments:</span>
              <span className="font-medium text-neutral-200">{summary.attachmentCount} files</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-750 text-neutral-300 hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-medium shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSubmitting ? 'Scheduling...' : 'Confirm & Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
