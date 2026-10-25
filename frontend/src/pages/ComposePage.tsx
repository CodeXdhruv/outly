import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Check, 
  Upload, 
  X, 
  Clock, 
  Send, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
} from 'lucide-react';
import { RichEditor } from '../components/RichEditor';
import type { Sender } from '../types';

export const ComposePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Form states
  const [senderId, setSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawLeadInput, setRawLeadInput] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [attachments] = useState<Array<{ id: string; filename: string; size: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch senders
  const { data: senders } = useQuery<Sender[]>({
    queryKey: ['senders'],
    queryFn: async () => {
      const res = await fetch('/api/senders');
      if (!res.ok) throw new Error('Failed to load senders');
      return res.json();
    },
  });

  React.useEffect(() => {
    if (senders && senders.length > 0 && !senderId) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileStats, setFileStats] = useState<{ name: string; added: number; duplicates: number; invalid: number } | null>(null);

  // Helper to extract emails from raw string or CSV
  const processFileContent = (text: string, filename: string) => {
    const isCsv = filename.toLowerCase().endsWith('.csv');
    const lines = text.split(/\r?\n/);
    const newEmails: string[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    // Email regex matching standard format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Detect CSV header if column 'email' exists
    let emailColIdx = -1;
    let startLine = 0;
    if (isCsv && lines.length > 0) {
      const headerCols = lines[0].split(',').map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      emailColIdx = headerCols.findIndex((col) => col.includes('email'));
      if (emailColIdx !== -1) {
        startLine = 1;
      } else {
        emailColIdx = 0;
      }
    }

    const currentSet = new Set(recipients);

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      let candidate = line;
      if (isCsv) {
        // Handle CSV comma splitting respecting quotes if any
        const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
        candidate = parts[emailColIdx >= 0 ? emailColIdx : 0] || '';
      }

      // Check if candidate matches or contains an email
      const matched = candidate.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g);
      if (matched) {
        for (const em of matched) {
          const lower = em.toLowerCase().trim();
          if (emailRegex.test(lower)) {
            if (currentSet.has(lower)) {
              duplicateCount++;
            } else {
              currentSet.add(lower);
              newEmails.push(lower);
            }
          } else {
            invalidCount++;
          }
        }
      } else if (candidate.length > 0) {
        invalidCount++;
      }
    }

    if (newEmails.length > 0) {
      setRecipients(Array.from(currentSet));
    }
    setFileStats({
      name: filename,
      added: newEmails.length,
      duplicates: duplicateCount,
      invalid: invalidCount,
    });
    setIsProcessingFile(false);
  };

  // Process uploaded or dropped File object
  const handleFileProcess = (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('File exceeds 2MB limit.');
      return;
    }
    setIsProcessingFile(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        processFileContent(text, file.name);
      } catch (err: any) {
        setErrorMessage(err.message || 'Error processing file.');
        setIsProcessingFile(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file.');
      setIsProcessingFile(false);
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // reset value so re-selecting same file triggers change
    e.target.value = '';
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleAddRawEmail = () => {
    if (!rawLeadInput.trim()) return;
    const emails = (rawLeadInput.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g) || []).map((em) => em.toLowerCase().trim());
    if (emails.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...emails])));
      setRawLeadInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  // Steps definition
  const steps = [
    { number: 1, label: 'Content' },
    { number: 2, label: 'Leads' },
    { number: 3, label: 'Schedule' },
    { number: 4, label: 'Review' },
  ];

  // Calculated estimates
  const recipientCount = recipients.length;
  const totalDurationMinutes = recipientCount > 0 ? Math.ceil((recipientCount * delaySeconds) / 60) : 0;
  const durationHours = Math.floor(totalDurationMinutes / 60);
  const durationRemainingMinutes = totalDurationMinutes % 60;
  const formattedDuration = durationHours > 0 
    ? `~${durationHours} hour${durationHours > 1 ? 's' : ''} ${durationRemainingMinutes} minutes` 
    : `~${durationRemainingMinutes} minutes`;

  const handleExecuteSend = async () => {
    if (recipients.length === 0) {
      setErrorMessage('Please add at least one recipient lead.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please provide a campaign subject line.');
      return;
    }

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
          startAt: new Date(startDate).toISOString(),
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
      navigate('/scheduled');
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error scheduling campaign');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
          Compose New Email
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload your leads, write your message and schedule your campaign.
        </p>
      </div>

      {/* 4-Step Stepper Header */}
      <div className="flex items-center justify-between max-w-xl py-2">
        {steps.map((st, idx) => {
          const isActive = currentStep === st.number;
          const isDone = currentStep > st.number;
          return (
            <React.Fragment key={st.number}>
              <div 
                onClick={() => setCurrentStep(st.number as any)}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-50'
                      : isDone
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : st.number}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {st.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-slate-200 mx-3" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Content */}
      {currentStep === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">From Sender</label>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {senders?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fromEmail}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              placeholder="Enter a compelling subject line..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Body</label>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <RichEditor value={bodyHtml} onChange={setBodyHtml} />
            </div>
          </div>

          <div className="pt-3 flex justify-between items-center border-t border-slate-100">
            <span className="text-xs text-slate-400">Step 1 of 4</span>
            <button
              type="button"
              onClick={() => {
                if (!subject.trim()) {
                  setErrorMessage('Please enter an email subject');
                  return;
                }
                setErrorMessage(null);
                setCurrentStep(2);
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <span>Next: Add Leads</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Leads */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">Add Your Leads</h2>
            <p className="text-xs text-slate-500">Upload a CSV or text file with email addresses, or paste them directly.</p>
          </div>

          {/* Drag & Drop Box */}
          <label 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragOver 
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
              isDragOver ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Upload className={`w-6 h-6 ${isProcessingFile ? 'animate-bounce' : ''}`} />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {isProcessingFile ? 'Processing file on the fly...' : 'Drag & drop your file here'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Supports CSV, TXT (max 2MB)</p>
            <input 
              type="file" 
              accept=".csv,.txt" 
              onChange={handleFileInputChange} 
              className="hidden" 
              disabled={isProcessingFile}
            />
            <span className="mt-3 inline-block px-3 py-1.5 text-xs font-medium text-indigo-600 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50">
              Browse Files
            </span>
          </label>

          {/* Instant feedback badge */}
          {fileStats && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{fileStats.name}</strong> processed: <strong>+{fileStats.added} new</strong>
                  {fileStats.duplicates > 0 && `, ${fileStats.duplicates} duplicate${fileStats.duplicates > 1 ? 's' : ''} skipped`}
                  {fileStats.invalid > 0 && `, ${fileStats.invalid} invalid ignored`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFileStats(null)}
                className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Direct Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste email or comma-separated addresses..."
              value={rawLeadInput}
              onChange={(e) => setRawLeadInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRawEmail())}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={handleAddRawEmail}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>

          {/* Detected Emails List */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Detected Email Addresses ({recipients.length} found)
              </span>
              {recipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecipients([])}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/40 divide-y divide-slate-100">
              {recipients.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">No recipients added yet.</div>
              ) : (
                recipients.map((rec) => (
                  <div key={rec} className="py-1.5 flex items-center justify-between text-xs text-slate-700">
                    <span className="font-mono">{rec}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(rec)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (recipients.length === 0) {
                  setErrorMessage('Please add at least one recipient lead');
                  return;
                }
                setErrorMessage(null);
                setCurrentStep(3);
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <span>Next: Schedule Settings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Schedule Settings */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900">Schedule Settings</h2>
              <p className="text-xs text-slate-500">Configure when and how your emails will be paced.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date & Time (UTC)</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Delay Between Emails (seconds)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={300}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-xs text-slate-400">Minimum delay between each email send to prevent spam flags.</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hourly Sending Limit</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-xs text-slate-400">Maximum number of emails to send per hour. Excess deferred with jitter.</span>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Next: Review Campaign</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Schedule Estimates Box */}
          <div className="lg:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Estimated Schedule</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Total Leads</span>
                  <span className="font-semibold text-slate-900 font-mono text-sm">{recipientCount} emails</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Start Time</span>
                  <span className="font-semibold text-slate-900 font-mono">{new Date(startDate).toLocaleString()}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Pacing & Limits</span>
                  <span className="font-semibold text-slate-900 font-mono">{delaySeconds}s delay · {hourlyLimit}/hr cap</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Estimated Duration</span>
                  <span className="font-semibold text-indigo-600 font-mono">{formattedDuration}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-400">
              Pacing calculations dynamically factor in your hourly throttle and queue jitter.
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {currentStep === 4 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">Campaign Review</h2>
            <p className="text-xs text-slate-500">Double check your outreach parameters before enqueuing jobs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[11px]">Subject</span>
              <p className="font-semibold text-slate-900">{subject}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[11px]">Total Recipients</span>
              <p className="font-semibold text-slate-900 font-mono">{recipients.length} recipients</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[11px]">Scheduled Start</span>
              <p className="font-semibold text-slate-900 font-mono">{new Date(startDate).toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[11px]">Pacing & Limits</span>
              <p className="font-semibold text-slate-900 font-mono">{delaySeconds}s delay · max {hourlyLimit}/hr</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <p className="text-xs text-indigo-900">
              Upon confirmation, {recipients.length} individual BullMQ email jobs will be staged in PostgreSQL and queued in Redis.
            </p>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleExecuteSend}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Scheduling...' : 'Schedule Campaign'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
