import React from 'react';
import { Clock, Send, Calendar } from 'lucide-react';

interface SendLaterPopoverProps {
  onSchedule: (date: Date) => void;
  onSendNow: () => void;
  disabled?: boolean;
}

export const SendLaterPopover: React.FC<SendLaterPopoverProps> = ({
  onSchedule,
  onSendNow,
  disabled,
}) => {
  const [open, setOpen] = React.useState(false);
  const [customDateTime, setCustomDateTime] = React.useState('');

  const quickOptions = [
    { label: 'In 10 minutes', getTs: () => new Date(Date.now() + 10 * 60 * 1000) },
    { label: 'In 30 minutes', getTs: () => new Date(Date.now() + 30 * 60 * 1000) },
    { label: 'In 1 hour', getTs: () => new Date(Date.now() + 60 * 60 * 1000) },
    { label: 'Tomorrow morning (9 AM UTC)', getTs: () => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 1);
        d.setUTCHours(9, 0, 0, 0);
        return d;
      }
    },
  ];

  return (
    <div className="relative inline-flex rounded-xl shadow-lg shadow-orange-500/10">
      <button
        type="button"
        disabled={disabled}
        onClick={onSendNow}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-l-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium text-sm transition-all disabled:opacity-50 cursor-pointer"
      >
        <Send className="w-4 h-4" />
        <span>Send Now</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="px-3 py-2.5 rounded-r-xl bg-orange-600 hover:bg-orange-700 text-white border-l border-orange-400/40 text-sm transition-all disabled:opacity-50 cursor-pointer"
        title="Schedule send"
      >
        <Clock className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-72 bg-neutral-900 border border-neutral-750 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 text-xs">
          <p className="font-semibold text-neutral-300 mb-2 px-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            <span>Schedule Send (UTC)</span>
          </p>

          <div className="space-y-1 mb-3">
            {quickOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSchedule(opt.getTs());
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="border-t border-neutral-800 pt-2 space-y-2">
            <label className="text-[11px] text-neutral-400">Custom Date & Time:</label>
            <input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-neutral-100 text-xs focus:outline-none focus:border-orange-500"
            />
            <button
              type="button"
              disabled={!customDateTime}
              onClick={() => {
                if (customDateTime) {
                  onSchedule(new Date(customDateTime));
                  setOpen(false);
                }
              }}
              className="w-full py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs disabled:opacity-40 cursor-pointer"
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
