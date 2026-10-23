import React from 'react';
import { X, Upload, CheckCircle } from 'lucide-react';

interface RecipientInputProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

export const RecipientInput: React.FC<RecipientInputProps> = ({ recipients, onChange }) => {
  const [inputValue, setInputValue] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadStats, setUploadStats] = React.useState<{
    valid: number;
    invalid: number;
    duplicates: number;
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const addEmail = (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed && !recipients.includes(trimmed)) {
      onChange([...recipients, trimmed]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault();
      if (inputValue) {
        addEmail(inputValue);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      onChange(recipients.slice(0, -1));
    }
  };

  const removeEmail = (index: number) => {
    onChange(recipients.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStats(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/leads/preview', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error?.message || 'Failed to parse file');
        return;
      }

      const data = await res.json();
      setUploadStats({
        valid: data.valid,
        invalid: data.invalid,
        duplicates: data.duplicates,
      });

      // Merge unique
      const merged = Array.from(new Set([...recipients, ...data.emails]));
      onChange(merged);
    } catch {
      alert('Error uploading recipient file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-neutral-400">Recipients ({recipients.length})</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isUploading ? 'Parsing file...' : 'Upload CSV / TXT List'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {uploadStats && (
        <div className="p-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60 text-xs flex items-center justify-between text-neutral-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>
              Added <strong>{uploadStats.valid}</strong> valid recipients.
            </span>
          </div>
          {(uploadStats.invalid > 0 || uploadStats.duplicates > 0) && (
            <span className="text-neutral-400 text-[11px]">
              ({uploadStats.invalid} invalid, {uploadStats.duplicates} duplicates skipped)
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-neutral-900 border border-neutral-800 rounded-xl focus-within:border-orange-500/80 transition-colors min-h-[46px] max-h-48 overflow-y-auto">
        {recipients.map((email, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 text-xs text-neutral-200 border border-neutral-700/60 font-mono"
          >
            <span>{email}</span>
            <button
              type="button"
              onClick={() => removeEmail(idx)}
              className="hover:text-rose-400 focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          type="email"
          placeholder={recipients.length === 0 ? 'Type email address and press Enter...' : 'Add another...'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue) {
              addEmail(inputValue);
              setInputValue('');
            }
          }}
          className="flex-1 min-w-[160px] bg-transparent text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none py-1 px-1"
        />
      </div>
    </div>
  );
};
