// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fillOtp, findSubmitButton } from '../src/content/otp';
import { IVAC_OTP_FORM } from './fixtures/ivac-otp-page';

describe('real IVAC OTP page', () => {
  beforeEach(() => {
    document.body.innerHTML = IVAC_OTP_FORM;
  });

  it('fills one digit in each of the 6 boxes', () => {
    const result = fillOtp(document, '482915');
    expect(result.success).toBe(true);
    const values = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="otp-"]')).map((i) => i.value);
    expect(values).toEqual(['4', '8', '2', '9', '1', '5']);
  });

  it('never puts the whole OTP into a single box', () => {
    fillOtp(document, '482915');
    const first = document.getElementById('otp-0') as HTMLInputElement;
    expect(first.value).toBe('4');
  });

  it('fills boxes in numeric id order even if the DOM order differs', () => {
    const wrap = document.getElementById('otp-0')!.parentElement!;
    wrap.appendChild(document.getElementById('otp-0')!); // move first box to the end
    fillOtp(document, '123456');
    const byId = [0, 1, 2, 3, 4, 5].map((n) => (document.getElementById(`otp-${n}`) as HTMLInputElement).value);
    expect(byId).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('rejects an OTP whose length does not match the 6 boxes', () => {
    const result = fillOtp(document, '1234');
    expect(result.success).toBe(false);
    expect(Array.from(document.querySelectorAll<HTMLInputElement>('input')).every((i) => i.value === '')).toBe(true);
  });

  it('highlights the Verify OTP button, not Resend OTP', () => {
    const result = fillOtp(document, '482915');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const button = findSubmitButton(result.anchor);
    expect(button?.textContent).toContain('Verify OTP');
    expect(button?.getAttribute('type')).toBe('submit');
  });
});