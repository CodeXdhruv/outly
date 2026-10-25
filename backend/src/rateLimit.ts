import { redis } from './db.js';
import { config } from './config.js';
import { logger } from './config.js';

/**
 * Lua script for atomic reservation
 *
 * KEYS: none required or dummy
 * ARGV[1]: senderId
 * ARGV[2]: senderLimit (hourly)
 * ARGV[3]: globalLimit (hourly)
 * ARGV[4]: spacingMs
 * ARGV[5]: now (epoch ms)
 */
const RESERVE_SCRIPT = `
local senderId = ARGV[1]
local senderLimit = tonumber(ARGV[2])
local globalLimit = tonumber(ARGV[3])
local spacingMs = tonumber(ARGV[4])
local now = tonumber(ARGV[5])

local hourStart = math.floor(now / 3600000) * 3600000
local hourEnd = hourStart + 3600000

local senderKey = "rl:sent:" .. senderId .. ":" .. hourStart
local globalKey = "rl:global:" .. hourStart
local nextKey = "rl:next:" .. senderId

local senderSent = tonumber(redis.call("GET", senderKey) or "0")
if senderSent >= senderLimit then
    return {0, tostring(hourEnd), "sender_cap"}
end

local globalSent = tonumber(redis.call("GET", globalKey) or "0")
if globalSent >= globalLimit then
    return {0, tostring(hourEnd), "global_cap"}
end

local nextAllowed = tonumber(redis.call("GET", nextKey) or "0")
if now < nextAllowed then
    return {0, tostring(nextAllowed), "spacing"}
end

redis.call("INCR", senderKey)
redis.call("EXPIRE", senderKey, 7200)

redis.call("INCR", globalKey)
redis.call("EXPIRE", globalKey, 7200)

redis.call("SET", nextKey, tostring(now + spacingMs), "EX", 3600)

return {1, "0", ""}
`;

export interface ReservationResult {
  ok: boolean;
  retryAt: number;
  reason: 'sender_cap' | 'global_cap' | 'spacing' | null;
}

export interface SystemSettings {
  maxEmailsPerHourPerSender: number;
  maxEmailsPerHourGlobal: number;
  minDelayBetweenSendsMs: number;
  maxRecipients: number;
}

const SETTINGS_KEY = 'system:sending_settings';

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const raw = await redis.get(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        maxEmailsPerHourPerSender: Number(parsed.maxEmailsPerHourPerSender) || config.MAX_EMAILS_PER_HOUR_PER_SENDER,
        maxEmailsPerHourGlobal: Number(parsed.maxEmailsPerHourGlobal) || config.MAX_EMAILS_PER_HOUR_GLOBAL,
        minDelayBetweenSendsMs: Number(parsed.minDelayBetweenSendsMs) || config.MIN_DELAY_BETWEEN_SENDS_MS,
        maxRecipients: Number(parsed.maxRecipients) || config.MAX_RECIPIENTS,
      };
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read dynamic system settings from Redis, falling back to config');
  }

  return {
    maxEmailsPerHourPerSender: config.MAX_EMAILS_PER_HOUR_PER_SENDER,
    maxEmailsPerHourGlobal: config.MAX_EMAILS_PER_HOUR_GLOBAL,
    minDelayBetweenSendsMs: config.MIN_DELAY_BETWEEN_SENDS_MS,
    maxRecipients: config.MAX_RECIPIENTS,
  };
}

export async function updateSystemSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const updated: SystemSettings = {
    maxEmailsPerHourPerSender: Math.max(1, Number(newSettings.maxEmailsPerHourPerSender ?? current.maxEmailsPerHourPerSender)),
    maxEmailsPerHourGlobal: Math.max(1, Number(newSettings.maxEmailsPerHourGlobal ?? current.maxEmailsPerHourGlobal)),
    minDelayBetweenSendsMs: Math.max(500, Number(newSettings.minDelayBetweenSendsMs ?? current.minDelayBetweenSendsMs)),
    maxRecipients: Math.max(1, Number(newSettings.maxRecipients ?? current.maxRecipients)),
  };

  await redis.set(SETTINGS_KEY, JSON.stringify(updated));
  logger.info({ updated }, 'Updated dynamic sending system settings');
  return updated;
}

export async function reserveSendSlot(
  senderId: string,
  senderLimit: number,
  spacingMs: number,
  nowMs: number = Date.now()
): Promise<ReservationResult> {
  const currentSettings = await getSystemSettings();
  const effectiveSenderLimit = Math.min(senderLimit, currentSettings.maxEmailsPerHourPerSender);
  const globalLimit = currentSettings.maxEmailsPerHourGlobal;
  const effectiveSpacingMs = Math.max(spacingMs, currentSettings.minDelayBetweenSendsMs);

  const res = (await redis.eval(
    RESERVE_SCRIPT,
    0,
    senderId,
    effectiveSenderLimit,
    globalLimit,
    effectiveSpacingMs,
    nowMs
  )) as [number, string, string];

  const ok = res[0] === 1;
  const retryAt = Number(res[1]);
  const reason = (res[2] as 'sender_cap' | 'global_cap' | 'spacing') || null;

  return { ok, retryAt, reason };
}

export async function releaseReservation(senderId: string, nowMs: number = Date.now()) {
  const hourStart = Math.floor(nowMs / 3600000) * 3600000;
  const senderKey = `rl:sent:${senderId}:${hourStart}`;
  const globalKey = `rl:global:${hourStart}`;

  try {
    const pipe = redis.pipeline();
    pipe.decr(senderKey);
    pipe.decr(globalKey);
    await pipe.exec();
  } catch (err) {
    logger.error({ err, senderId }, 'Failed to release reservation counter');
  }
}

