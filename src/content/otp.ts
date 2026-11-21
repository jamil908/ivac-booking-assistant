/**
 * OTP field detection and filling (pure DOM helpers, no chrome.* APIs)
 * Never touches password / phone / username fields unless the field
 * itself clearly says it is an OTP field.
 */

export const OTP_MIN_LENGTH = 4;
export const OTP_MAX_LENGTH = 8;

const OTP_PATTERN = new RegExp(`^\\d{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}$`);

export function isValidOtp(value: unknown): value is string {
  return typeof value === 'string' && OTP_PATTERN.test(value);
}

export type OtpFillResult =
  | { success: true; mode: 'single' | 'split'; anchor: HTMLInputElement }
  | { success: false; error: string };

const TEXT_LIKE_TYPES = new Set(['', 'text', 'tel', 'number', 'password']);

const STRONG_HINT = /otp|one[-_ ]?time|verif|passcode/i;
const WEAK_EXCLUDE = /phone|mobile|msisdn|e-?mail|user(name)?|login|passport|web[-_ ]?file|captcha|search|date|birth/i;

function hintText(el: HTMLInputElement): string {
  return [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('autocomplete') ?? '',
    el.className,
  ].join(' ');
}

export function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;

  let node: HTMLElement | null = el;
  while (node && node !== node.ownerDocument.body) {
    if (node.hidden) return false;
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return false;
    }
    node = node.parentElement;
  }
  return true;
}

function isUsable(el: HTMLInputElement): boolean {
  return (
    TEXT_LIKE_TYPES.has(el.type) &&
    !el.disabled &&
    !el.readOnly &&
    isVisible(el)
  );
}

function scoreSingle(el: HTMLInputElement): number {
  // A box that holds one character is part of a split OTP, never a single OTP field
  if (el.maxLength === 1) return -1;

  const hint = hintText(el);
  const autocomplete = (el.getAttribute('autocomplete') ?? '').toLowerCase();
  const strong = autocomplete === 'one-time-code' || STRONG_HINT.test(hint);

  // A password-type field is only acceptable if it clearly says it is an OTP field
  if (el.type === 'password' && !strong) return -1;

  const maxLength = el.maxLength > 0 ? el.maxLength : 0;
  const lengthOk = maxLength >= OTP_MIN_LENGTH && maxLength <= OTP_MAX_LENGTH;
  const numeric =
    el.type === 'tel' ||
    el.type === 'number' ||
    (el.getAttribute('inputmode') ?? '').toLowerCase() === 'numeric';

  if (strong) {
    return 10 + (lengthOk ? 3 : 0) + (numeric ? 1 : 0);
  }

  // Weak candidates: no OTP wording, so they must look like one AND not look like something else
  if (WEAK_EXCLUDE.test(hint)) return -1;
  return (lengthOk ? 3 : 0) + (numeric ? 2 : 0);
}

const WEAK_MIN_SCORE = 5;

type OtpTarget =
  | { kind: 'single'; input: HTMLInputElement }
  | { kind: 'split'; inputs: HTMLInputElement[] };
/** IVAC style: id="otp-0" ... id="otp-5", filled in numeric order */
function findIdIndexedGroup(doc: Document): HTMLInputElement[] | null {
  const indexed = Array.from(doc.querySelectorAll<HTMLInputElement>('input'))
    .filter((el) => /^otp[-_]?\d+$/i.test(el.id) && el.maxLength === 1 && isUsable(el))
    .map((el) => ({ el, n: Number(el.id.replace(/\D/g, '')) }))
    .sort((a, b) => a.n - b.n)
    .map((item) => item.el);

  return indexed.length >= OTP_MIN_LENGTH && indexed.length <= OTP_MAX_LENGTH
    ? indexed
    : null;
}
function findSplitGroup(doc: Document): HTMLInputElement[] | null {
  const boxes = Array.from(doc.querySelectorAll<HTMLInputElement>('input')).filter(
    (el) => isUsable(el) && el.maxLength === 1 && el.type !== 'password'
  );

  const groups = new Map<Element, HTMLInputElement[]>();
  for (const box of boxes) {
    const root = box.closest('form') ?? box.parentElement?.parentElement ?? doc.body;
    const list = groups.get(root) ?? [];
    list.push(box);
    groups.set(root, list);
  }

  for (const list of groups.values()) {
    if (list.length >= OTP_MIN_LENGTH && list.length <= OTP_MAX_LENGTH) {
      return list;
    }
  }
  return null;
}

export function findOtpTarget(doc: Document): OtpTarget | null {
  const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input')).filter(isUsable);

  let best: HTMLInputElement | null = null;
  let bestScore = -1;
  for (const input of inputs) {
    const score = scoreSingle(input);
    if (score > bestScore) {
      best = input;
      bestScore = score;
    }
  }

  if (best && bestScore >= 10) return { kind: 'single', input: best };

    const split = findIdIndexedGroup(doc) ?? findSplitGroup(doc);
  if (split) return { kind: 'split', inputs: split };

  if (best && bestScore >= WEAK_MIN_SCORE) return { kind: 'single', input: best };
  return null;
}

/** Works with React/Angular/Vue-controlled inputs */
export function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillOtp(doc: Document, otp: unknown): OtpFillResult {
  if (!isValidOtp(otp)) {
    return {
      success: false,
      error: `Invalid OTP. Enter ${OTP_MIN_LENGTH}–${OTP_MAX_LENGTH} digits.`,
    };
  }

  const target = findOtpTarget(doc);
  if (!target) {
    return { success: false, error: 'OTP input field not found on this page.' };
  }

  if (target.kind === 'single') {
    const { input } = target;
    if (input.maxLength > 0 && input.maxLength < otp.length) {
      return {
        success: false,
        error: `This field accepts ${input.maxLength} digits but the OTP has ${otp.length}.`,
      };
    }
    setNativeValue(input, otp);
    if (input.value !== otp) {
      return { success: false, error: 'OTP could not be filled successfully.' };
    }
    return { success: true, mode: 'single', anchor: input };
  }

  const { inputs } = target;
  if (inputs.length !== otp.length) {
    return {
      success: false,
      error: `This page has ${inputs.length} OTP boxes but the OTP has ${otp.length} digits.`,
    };
  }

  inputs.forEach((box, i) => {
    const digit = otp.charAt(i);
    setNativeValue(box, digit);
    box.dispatchEvent(new KeyboardEvent('keyup', { key: digit, bubbles: true }));
  });

  if (inputs.map((b) => b.value).join('') !== otp) {
    return { success: false, error: 'OTP could not be filled successfully.' };
  }
  return { success: true, mode: 'split', anchor: inputs[inputs.length - 1] as HTMLInputElement };
}

const SUBMIT_TEXT = /verify|submit|confirm|continue|login|log in|next|proceed/i;

/** Prefer the button that belongs to the same form / container as the OTP field */
export function findSubmitButton(anchor: HTMLInputElement): HTMLElement | null {
  const selector = 'button, input[type="submit"], input[type="button"]';

  const form = anchor.form;
  if (form) {
    const inForm = form.querySelector<HTMLElement>(
      'button[type="submit"], input[type="submit"], button:not([type])'
    );
    if (inForm && isVisible(inForm)) return inForm;
  }

  let container: HTMLElement | null = anchor.parentElement;
  for (let depth = 0; container && depth < 5; depth++) {
    const buttons = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
    const match = buttons.find((b) =>
      SUBMIT_TEXT.test((b as HTMLInputElement).value || b.textContent || '')
    );
    if (match) return match;
    container = container.parentElement;
  }
  return null;
}