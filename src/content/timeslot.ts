import { isVisible } from './otp';
import { findButtonByText } from './navigation';

/**
 * Date page: ONE careful pass over the dates that are open right now, earliest first.
 * - at least 15 seconds between two attempts (hard minimum)
 * - at most 10 attempts, no page refresh, no month change
 * - stops when the page is left (payment page), when you press Pause, or when a popup cannot be closed
 */

export const MIN_GAP_MS = 15_000;
export const MAX_ATTEMPTS = 10;
const SETTLE_MS = 8_000;
const RESULT_MS = 10_000;
const POLL_MS = 250;

const UNAVAILABLE = /temporar\w*\s+held|all\s+slots?|no\s+slots?\s+(are\s+)?available/i;
const DISMISS_TEXT = /^\s*(ok|okay|close|got it|dismiss|try another date)\s*$/i;
const CONTINUE = /continue\s+booking/i;

export function getEnabledDates(doc: Document): number[] {
  const days: number[] = [];
  for (const button of Array.from(doc.querySelectorAll<HTMLButtonElement>('button'))) {
    const text = (button.textContent ?? '').trim();
    if (!/^\d{1,2}$/.test(text) || button.disabled || !isVisible(button)) continue;
    const day = Number(text);
    if (day >= 1 && day <= 31 && !days.includes(day)) days.push(day);
  }
  return days.sort((a, b) => a - b);
}

export function findDateButton(doc: Document, day: number): HTMLButtonElement | null {
  return (
    Array.from(doc.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.textContent ?? '').trim() === String(day) && !b.disabled && isVisible(b)
    ) ?? null
  );
}

function findUnavailableText(doc: Document): Text | null {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (UNAVAILABLE.test(node.textContent ?? '') && parent && isVisible(parent)) return node as Text;
    node = walker.nextNode();
  }
  return null;
}

export function isUnavailablePopupVisible(doc: Document): boolean {
  return findUnavailableText(doc) !== null;
}

function continueButton(doc: Document): HTMLElement | null {
  return findButtonByText(doc, CONTINUE);
}

function isEnabled(el: HTMLElement | null): el is HTMLElement {
  return !!el && (el as HTMLButtonElement).disabled !== true && el.getAttribute('aria-disabled') !== 'true';
}

export type DateCycleOutcome =
  | { status: 'left-page'; day: number; tried: number[] }
  | { status: 'exhausted'; tried: number[] }
  | { status: 'stopped'; reason: string; tried: number[] };

export interface DateCycleDeps {
  doc: Document;
  isRunning: () => Promise<boolean>;
  isOnPage: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onStatus?: (message: string) => void;
}

export async function runDateCycle(deps: DateCycleDeps): Promise<DateCycleOutcome> {
  const { doc } = deps;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const tried: number[] = [];

  async function waitFor<T>(check: () => T | null, timeoutMs: number): Promise<T | null> {
    const started = now();
    for (;;) {
      const found = check();
      if (found !== null) return found;
      if (now() - started >= timeoutMs) return null;
      await sleep(POLL_MS);
    }
  }

  async function dismissPopup(): Promise<boolean> {
    const textNode = findUnavailableText(doc);
    if (!textNode) return true;

    let container: HTMLElement | null = textNode.parentElement;
    let clicked = false;
       for (let depth = 0; container && depth < 8 && container !== doc.body; depth++) {
      const target = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]'))
        .filter(isVisible)
        .find(
          (b) => DISMISS_TEXT.test(b.textContent ?? '') || /close|dismiss/i.test(b.getAttribute('aria-label') ?? '')
        );
      if (target) {
        target.click();
        clicked = true;
        break;
      }
      container = container.parentElement;
    }
    if (!clicked) doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const gone = await waitFor(() => (isUnavailablePopupVisible(doc) ? null : true), 3_000);
    return gone === true;
  }

  const days = getEnabledDates(doc).slice(0, MAX_ATTEMPTS);
  if (days.length === 0) return { status: 'exhausted', tried };

  let lastAttemptAt: number | null = null;

  for (const day of days) {
    if (!(await deps.isRunning())) return { status: 'stopped', reason: 'Auto mode was paused.', tried };

    if (lastAttemptAt !== null) {
      const remaining = lastAttemptAt + MIN_GAP_MS - now();
      if (remaining > 0) await sleep(remaining);
      if (!(await deps.isRunning())) return { status: 'stopped', reason: 'Auto mode was paused.', tried };
    }
    if (!deps.isOnPage()) return { status: 'left-page', day, tried };

    lastAttemptAt = now();
    const button = findDateButton(doc, day);
    if (!button) continue;

    tried.push(day);
    deps.onStatus?.(`Checking date ${day}...`);
    button.click();

    // either the site refuses the date (popup) or it lets us continue
    const first = await waitFor<'popup' | 'continue'>(() => {
      if (isUnavailablePopupVisible(doc)) return 'popup';
      return isEnabled(continueButton(doc)) ? 'continue' : null;
    }, SETTLE_MS);

    if (first === 'popup') {
      if (!(await dismissPopup())) {
        return { status: 'stopped', reason: 'The "no slots" popup could not be closed. Please close it yourself.', tried };
      }
      continue;
    }
    if (first !== 'continue') continue;

    const next = continueButton(doc);
    if (!isEnabled(next)) continue;
    next.click();

    const second = await waitFor<'left' | 'popup'>(() => {
      if (!deps.isOnPage()) return 'left';
      return isUnavailablePopupVisible(doc) ? 'popup' : null;
    }, RESULT_MS);

    if (second === 'left') return { status: 'left-page', day, tried };
    if (second === 'popup' && !(await dismissPopup())) {
      return { status: 'stopped', reason: 'The "no slots" popup could not be closed. Please close it yourself.', tried };
    }
  }

  return { status: 'exhausted', tried };
}