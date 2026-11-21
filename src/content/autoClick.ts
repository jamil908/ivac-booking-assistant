import { isVisible } from './otp';

/**
 * Start/Pause switch shared with the popup through chrome.storage.local.
 * Keep this string identical to AUTOMATION_KEY in src/popup/index.tsx
 * (do NOT import this file from the popup or background: content script must stay a standalone bundle).
 */
export const AUTOMATION_KEY = 'ivac_automation_running';

const ATTEMPT_COOLDOWN_MS = 60_000;
const attempts = new Map<string, number>();

export type AutoSubmitStatus =
  | 'paused'
  | 'cooldown'
  | 'no-button'
  | 'timeout'
  | 'clicked';

export async function isAutomationRunning(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(AUTOMATION_KEY);
    return stored[AUTOMATION_KEY] === true;
  } catch {
    return false;
  }
}

export async function pauseAutomation(): Promise<void> {
  try {
    await chrome.storage.local.set({ [AUTOMATION_KEY]: false });
  } catch {
    // nothing else to do
  }
}

/** Polls until the button exists (React pages render it a moment after the route changes) */
async function findWithWait(
  find: () => HTMLElement | null,
  waitMs: number,
  intervalMs = 250
): Promise<HTMLElement | null> {
  const started = Date.now();
  let found = find();
  while (!found && Date.now() - started < waitMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    found = find();
  }
  return found;
}

/** Resolves true when the button becomes enabled, false on timeout or if it disappears */
export function waitUntilEnabled(
  button: HTMLElement,
  timeoutMs = 15_000,
  intervalMs = 250
): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();

    const check = () => {
      if (!button.isConnected) return resolve(false);

      const disabled =
        (button as HTMLButtonElement).disabled === true ||
        button.getAttribute('aria-disabled') === 'true';

      if (!disabled && isVisible(button)) return resolve(true);
      if (Date.now() - started >= timeoutMs) return resolve(false);

      setTimeout(check, intervalMs);
    };

    check();
  });
}

/**
 * When the Start switch is on: wait for the button to become enabled and click it ONCE.
 * - never retries (one attempt per key per cooldown)
 * - never touches security checks; if the button stays disabled it gives up and pauses
 */
export async function autoSubmitIfRunning(
  key: string,
  findButton: () => HTMLElement | null,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    now?: () => number;
    /** keep looking for the button this long before giving up (default: look once) */
    waitForButtonMs?: number;
    /** pause the Start switch when the button is missing (default: true) */
    pauseOnMissing?: boolean;
    /** minimum time before the same step may be attempted again (default: 60 s) */
    cooldownMs?: number;
  } = {}
): Promise<AutoSubmitStatus> {
  if (!(await isAutomationRunning())) return 'paused';

  const now = (options.now ?? Date.now)();
  const last = attempts.get(key);
  if (last !== undefined && now - last < (options.cooldownMs ?? ATTEMPT_COOLDOWN_MS)) {
    return 'cooldown';
  }
  attempts.set(key, now);

  const button = await findWithWait(findButton, options.waitForButtonMs ?? 0, options.intervalMs);
  if (!button) {
    if (options.pauseOnMissing !== false) await pauseAutomation();
    return 'no-button';
  }

  const enabled = await waitUntilEnabled(button, options.timeoutMs, options.intervalMs);
  if (!enabled) {
    await pauseAutomation();
    return 'timeout';
  }

  button.click();
  return 'clicked';
}