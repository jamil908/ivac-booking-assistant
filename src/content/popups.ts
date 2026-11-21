import { isVisible } from './otp';

/**
 * The confirmation popup that comes before the upload area:
 * "Confirm to continue - Please confirm to proceed to uploading your web files." with a Confirm button.
 * Two ways to find its Confirm button, both very narrow:
 * 1. by the popup's own wording: the button must sit in the same card as that text
 * 2. fallback: a button that says exactly Confirm / I confirm / Yes, confirm / Agree / I agree /
 *    I understand / Accept, inside a popup layer (role=dialog, aria-modal, or position: fixed)
 * The page's own buttons ("Confirm All Information is Correct", "Confirm Mission & IVAC Center")
 * and the popup's close (X) button never match.
 */

const CONFIRM_TEXT = /^(yes[,!.]?\s*)?(i\s+)?(confirm|agree|understand|accept)$/i;
const POPUP_PROMPT = /confirm\s+to\s+continue|proceed\s+to\s+uploading\s+your\s+web\s*files/i;

function buttonText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isClickable(el: HTMLElement): boolean {
  return isVisible(el) && (el as HTMLButtonElement).disabled !== true && el.getAttribute('aria-disabled') !== 'true';
}

export function isInsideOverlay(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  while (node && node !== node.ownerDocument.body) {
    if (node.getAttribute('role') === 'dialog' || node.getAttribute('aria-modal') === 'true') return true;
    if (node.ownerDocument.defaultView?.getComputedStyle(node).position === 'fixed') return true;
    node = node.parentElement;
  }
  return false;
}

/** The Confirm button in the same card as the popup's own text, found without relying on any CSS */
function findByPrompt(doc: Document): HTMLElement | null {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (parent && POPUP_PROMPT.test(node.textContent ?? '') && isVisible(parent)) {
      let container: HTMLElement | null = parent;
      for (let depth = 0; container && depth < 5 && container !== doc.body; depth++) {
        const button = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
          (b) => isClickable(b) && CONFIRM_TEXT.test(buttonText(b))
        );
        if (button) return button;
        container = container.parentElement;
      }
    }
    node = walker.nextNode();
  }
  return null;
}

function findByOverlay(doc: Document): HTMLElement | null {
  const buttons = Array.from(doc.querySelectorAll<HTMLElement>('button, [role="button"]'));
  return buttons.find((b) => isClickable(b) && CONFIRM_TEXT.test(buttonText(b)) && isInsideOverlay(b)) ?? null;
}

export function findConfirmPopupButton(doc: Document): HTMLElement | null {
  return findByPrompt(doc) ?? findByOverlay(doc);
}

export interface ConfirmPopupOptions {
  /** true once the page behind the popup is ready, so we do not wait for a popup that never comes */
  isReady?: () => boolean;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onAccepted?: () => void;
}

/** Clicks the confirmation popup at most once. Returns true if it was clicked. */
export async function acceptConfirmPopup(doc: Document, options: ConfirmPopupOptions = {}): Promise<boolean> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const maxMs = options.maxMs ?? 10_000;
  const started = now();

  for (;;) {
    const button = findConfirmPopupButton(doc);
    if (button) {
      button.click();
      options.onAccepted?.();
      return true;
    }

    const elapsed = now() - started;
    if (elapsed >= maxMs) return false;
    // the page is already usable and no popup showed up after a short moment: nothing to confirm
    if (options.isReady?.() && elapsed >= 1_500) return false;

    await sleep(250);
  }
}
const CLOSE_LABEL = /^close( popup)?$/i;

/** True when the close button belongs to the "Confirm to continue" popup, which must not be closed */
function belongsToConfirmPopup(button: HTMLElement): boolean {
  let node: HTMLElement | null = button.parentElement;
  for (let depth = 0; node && depth < 3; depth++) {
    if (POPUP_PROMPT.test(node.textContent ?? '')) return true;
    node = node.parentElement;
  }
  return false;
}

/** The X button of an information popup (advisory / important notice), found by its aria-label */
export function findInfoPopupCloseButton(doc: Document): HTMLElement | null {
  const buttons = Array.from(doc.querySelectorAll<HTMLElement>('button[aria-label]'));
  return (
    buttons.find(
      (b) => CLOSE_LABEL.test(b.getAttribute('aria-label') ?? '') && isClickable(b) && !belongsToConfirmPopup(b)
    ) ?? null
  );
}

export interface CloseInfoPopupsOptions {
  maxClosed?: number;
  /** how long to wait for a first popup to appear */
  firstWaitMs?: number;
  /** after a popup was closed, how long to wait for the next one */
  idleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onClosed?: (count: number) => void;
}

/** Closes the information popups that appear one after another after login. Returns how many were closed. */
export async function closeInfoPopups(doc: Document, options: CloseInfoPopupsOptions = {}): Promise<number> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const maxClosed = options.maxClosed ?? 6;
  let closed = 0;
  let lastActivity = now();

  for (;;) {
    const button = findInfoPopupCloseButton(doc);
    if (button) {
      button.click();
      closed++;
      options.onClosed?.(closed);
      if (closed >= maxClosed) return closed;
      lastActivity = now();
      await sleep(500);
      continue;
    }

    const patience = closed === 0 ? (options.firstWaitMs ?? 2_500) : (options.idleMs ?? 1_500);
    if (now() - lastActivity >= patience) return closed;
    await sleep(250);
  }
}