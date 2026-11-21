/**
 * Activity log, written by the background script only (the content script sends its lines as messages).
 * Lines are cleaned before they are stored: long digit runs (phone numbers, OTPs) and e-mail addresses
 * are masked, and only plain values are kept in `data`.
 */
import type { LogEntry } from '../types';

export const LOG_KEY = 'ivac_log';
export const MAX_LOG_ENTRIES = 300;

const MAX_STEP = 40;
const MAX_MSG = 300;

function mask(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\d{6,}/g, '[digits]');
}

export function sanitizeLogEntry(raw: unknown, now: number = Date.now()): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (r.level !== 'info' && r.level !== 'warn' && r.level !== 'error') return null;
  if (typeof r.step !== 'string' || typeof r.msg !== 'string') return null;

  const entry: LogEntry = {
    t: now,
    level: r.level,
    step: mask(r.step).slice(0, MAX_STEP),
    msg: mask(r.msg).slice(0, MAX_MSG),
  };

  if (r.data && typeof r.data === 'object') {
    const data: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(r.data as Record<string, unknown>).slice(0, 10)) {
      if (typeof value === 'string') data[key.slice(0, 30)] = mask(value).slice(0, 120);
      else if (typeof value === 'number' || typeof value === 'boolean') data[key.slice(0, 30)] = value;
    }
    if (Object.keys(data).length > 0) entry.data = data;
  }
  return entry;
}

// one write at a time, so lines from the page and from the background never overwrite each other
let queue: Promise<void> = Promise.resolve();

export function appendLog(entry: LogEntry): Promise<void> {
  queue = queue
    .then(async () => {
      const stored = await chrome.storage.local.get(LOG_KEY);
      const list = (stored[LOG_KEY] as LogEntry[] | undefined) ?? [];
      list.push(entry);
      await chrome.storage.local.set({ [LOG_KEY]: list.slice(-MAX_LOG_ENTRIES) });
    })
    .catch(() => undefined);
  return queue;
}

export async function getLog(): Promise<LogEntry[]> {
  const stored = await chrome.storage.local.get(LOG_KEY);
  return (stored[LOG_KEY] as LogEntry[] | undefined) ?? [];
}

export async function clearLog(): Promise<void> {
  await chrome.storage.local.remove(LOG_KEY);
}