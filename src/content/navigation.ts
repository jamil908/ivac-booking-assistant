import { isVisible } from './otp';
export const MISSION_PATH = '/appointment/mission';
export const TIME_SLOT_PATH = '/appointment/time-slot';
/**
 * Navigation-only steps on appointment.ivacbd.com after login:
 *   /                         -> "Take Your Appointment"
 *   /appointment/notice       -> "Next Step"
 *   /appointment/file-upload  (stop here, nothing is clicked or uploaded automatically)
 */

const APPOINTMENT_HOST = 'appointment.ivacbd.com';

export interface NavStep {
  id: string;
  host: string;
  path: string;
  buttonText: RegExp;
}

export const NAV_STEPS: NavStep[] = [
  { id: 'take-appointment', host: APPOINTMENT_HOST, path: '/', buttonText: /take\s+your\s+appointment/i },
  { id: 'notice-next', host: APPOINTMENT_HOST, path: '/appointment/notice', buttonText: /^\s*next\s+step\s*$/i },
];

export const UPLOAD_PATH = '/appointment/file-upload';

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function findNavStep(host: string, pathname: string): NavStep | null {
  const path = normalizePath(pathname);
  return NAV_STEPS.find((step) => step.host === host && step.path === path) ?? null;
}

export function isUploadPage(host: string, pathname: string): boolean {
  return host === APPOINTMENT_HOST && normalizePath(pathname) === UPLOAD_PATH;
}
export function isMissionPage(host: string, pathname: string): boolean {
  return host === APPOINTMENT_HOST && normalizePath(pathname) === MISSION_PATH;
}

export function isTimeSlotPage(host: string, pathname: string): boolean {
  return host === APPOINTMENT_HOST && normalizePath(pathname) === TIME_SLOT_PATH;
}
/** First visible button (or role=button) whose text matches */
export function findButtonByText(doc: Document, pattern: RegExp): HTMLElement | null {
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>('button, [role="button"]')
  );

  return (
    candidates.find(
      (el) => isVisible(el) && pattern.test((el.textContent ?? '').replace(/\s+/g, ' ').trim())
    ) ?? null
  );
}