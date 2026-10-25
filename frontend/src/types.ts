export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

export interface Sender {
  id: string;
  fromEmail: string;
}

export interface EmailListItem {
  id: string;
  recipientEmail: string;
  subject: string;
  preview: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  deferred: boolean;
  starred: boolean;
  senderEmail: string;
}

export interface EmailDetail extends EmailListItem {
  bodyHtml: string;
  attemptCount: number;
  errorMessage?: string | null;
  attachments: Array<{
    id: string;
    filename: string;
    size: number;
    mimeType: string;
  }>;
}

export interface EmailCounts {
  scheduled: number;
  sent: number;
  failed?: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channel?: string;
  revoked?: boolean;
}

export interface SystemSettings {
  maxEmailsPerHourPerSender: number;
  maxEmailsPerHourGlobal: number;
  minDelayBetweenSendsMs: number;
  maxRecipients: number;
}

