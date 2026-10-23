import { describe, it, expect, beforeAll } from 'vitest';
import { parseRecipients, sanitizeBody, classifySmtpError } from '../src/email.js';
import { encryptToken, decryptToken, signSlackState, verifySlackState } from '../src/slack.js';
import { reserveSendSlot } from '../src/rateLimit.js';

describe('Email helper functions', () => {
  it('parses CSV recipients with headers and handles invalid/duplicates', () => {
    const csvContent = `Email,Name
user1@test.com,User One
INVALID_EMAIL,Invalid
user1@test.com,Duplicate One
user2@test.com,User Two`;

    const parsed = parseRecipients(csvContent, true);
    expect(parsed.valid).toEqual(['user1@test.com', 'user2@test.com']);
    expect(parsed.invalid.length).toBe(1);
    expect(parsed.duplicates.length).toBe(1);
  });

  it('parses TXT recipients ignoring blank lines and comments', () => {
    const txtContent = `
# Comment line
hello@world.com

foo@bar.com
invalid
`;
    const parsed = parseRecipients(txtContent, false);
    expect(parsed.valid).toEqual(['hello@world.com', 'foo@bar.com']);
    expect(parsed.invalid.length).toBe(1);
  });

  it('sanitizes bodyHtml removing script and unsafe elements', () => {
    const maliciousHtml = `<p>Safe text</p><script>alert('xss')</script><a href="javascript:alert(1)">Click</a><a href="https://example.com">Legit</a>`;
    const { bodyHtml, bodyText, preview } = sanitizeBody(maliciousHtml);

    expect(bodyHtml).not.toContain('<script>');
    expect(bodyHtml).not.toContain('javascript:');
    expect(bodyHtml).toContain('https://example.com');
    expect(bodyText).toBe('Safe text Click Legit');
    expect(preview).toBe('Safe text Click Legit');
  });

  it('classifies SMTP errors correctly', () => {
    expect(classifySmtpError({ code: '550' }).type).toBe('permanent');
    expect(classifySmtpError({ code: 'EENVELOPE' }).type).toBe('permanent');
    expect(classifySmtpError({ code: 'ECONNECTION' }).type).toBe('transient');
    expect(classifySmtpError({ code: 'ETIMEDOUT' }).type).toBe('transient');
    expect(classifySmtpError({ code: '421' }).type).toBe('transient');
  });
});

describe('Slack Security and State', () => {
  it('encrypts and decrypts webhook tokens using AES-256-GCM', () => {
    const raw = 'https://hooks.slack.com/services/T123/B456/token789';
    const encrypted = encryptToken(raw);
    expect(encrypted).not.toBe(raw);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(raw);
  });

  it('signs and verifies slack state', () => {
    const { state, nonce } = signSlackState('user-123');
    const verified = verifySlackState(state);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('user-123');
    expect(verified?.nonce).toBe(nonce);
  });
});

describe('Rate limiting with Redis Lua', () => {
  it('enforces atomic reservation and spacing', async () => {
    const senderId = 'test-sender-' + Date.now();
    const res1 = await reserveSendSlot(senderId, 2, 500);
    expect(res1.ok).toBe(true);

    // Spacing immediately after
    const res2 = await reserveSendSlot(senderId, 2, 500);
    expect(res2.ok).toBe(false);
    expect(res2.reason).toBe('spacing');
  });
});
