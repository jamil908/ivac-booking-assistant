// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { findButtonByText, findNavStep, isUploadPage, normalizePath } from '../src/content/navigation';

const HOST = 'appointment.ivacbd.com';

describe('route matching', () => {
  it('normalizes paths', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/appointment/notice/')).toBe('/appointment/notice');
  });

  it('finds the step for each known page', () => {
    expect(findNavStep(HOST, '/')?.id).toBe('take-appointment');
    expect(findNavStep(HOST, '/appointment/notice')?.id).toBe('notice-next');
    expect(findNavStep(HOST, '/appointment/notice/')?.id).toBe('notice-next');
  });

  it('does nothing on other pages or other hosts', () => {
    expect(findNavStep(HOST, '/appointment/file-upload')).toBeNull();
    expect(findNavStep(HOST, '/login')).toBeNull();
    expect(findNavStep('payment.ivacbd.com', '/')).toBeNull();
    expect(findNavStep('example.com', '/appointment/notice')).toBeNull();
  });

  it('recognises the upload page (the stop point)', () => {
    expect(isUploadPage(HOST, '/appointment/file-upload')).toBe(true);
    expect(isUploadPage(HOST, '/appointment/file-upload/')).toBe(true);
    expect(isUploadPage(HOST, '/appointment/notice')).toBe(false);
    expect(isUploadPage('example.com', '/appointment/file-upload')).toBe(false);
  });
});

describe('findButtonByText (real IVAC button markup)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds "Take Your Appointment" even though the text is inside a span', () => {
    document.body.innerHTML = `
      <button class="x"><span class="text-base">Take Your Appointment</span><div><svg></svg></div></button>`;
    const step = findNavStep(HOST, '/')!;
    expect(findButtonByText(document, step.buttonText)?.textContent).toContain('Take Your Appointment');
  });

  it('finds "Next Step" but not other buttons', () => {
    document.body.innerHTML = `
      <button id="back"><span>Previous Step</span></button>
      <button id="next"><span>Next Step</span><span><svg></svg></span></button>`;
    const step = findNavStep(HOST, '/appointment/notice')!;
    expect(findButtonByText(document, step.buttonText)?.id).toBe('next');
  });

  it('never matches the declaration button on the upload page', () => {
    document.body.innerHTML = `
      <button disabled type="button"><span>Confirm All Information is Correct</span></button>`;
    for (const step of [findNavStep(HOST, '/')!, findNavStep(HOST, '/appointment/notice')!]) {
      expect(findButtonByText(document, step.buttonText)).toBeNull();
    }
  });

  it('ignores hidden buttons', () => {
    document.body.innerHTML = '<button style="display:none">Next Step</button>';
    const step = findNavStep(HOST, '/appointment/notice')!;
    expect(findButtonByText(document, step.buttonText)).toBeNull();
  });
});