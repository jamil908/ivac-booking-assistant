/**
 * Upload helpers for the IVAC "file-upload" page.
 * The page asks for "Upload Primary Applicant's Webfile" first, then "Upload Other Applicant's Webfile",
 * and shows "Total number of applicants: N". Selecting a file cannot be undone on the site,
 * so everything here fails closed: any surprise stops the run.
 */

export interface UploadFile {
  id: string;
  name: string;
  role: 'primary' | 'secondary';
  dataBase64: string;
}

export type UploadOutcome =
  | { ok: true; uploaded: number; total: number }
  | { ok: false; uploaded: number; total: number; reason: string };

export function readApplicantCount(doc: Document): number | null {
  const text = doc.body?.textContent ?? '';
  const match = text.match(/total\s+number\s+of\s+applicants\s*:?\s*(\d+)/i);
  return match?.[1] !== undefined ? Number(match[1]) : null;
}

const UPLOAD_LABEL = /upload\s+(primary|other)\b[^]*?web\s*file/i;

function findUploadLabel(doc: Document): { label: HTMLLabelElement; kind: 'primary' | 'other' } | null {
  for (const label of Array.from(doc.querySelectorAll('label'))) {
    const match = (label.textContent ?? '').match(UPLOAD_LABEL);
    if (match) return { label, kind: match[1]?.toLowerCase() === 'primary' ? 'primary' : 'other' };
  }
  return null;
}

/** The file input that sits next to the "Upload ... Webfile" label (the page has a second hidden input) */
export function findUploadInput(
  doc: Document
): { input: HTMLInputElement; kind: 'primary' | 'other' } | null {
  const found = findUploadLabel(doc);
  if (!found) return null;

  let node = found.label.parentElement;
  while (node && node !== doc.body) {
    const input = node.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) return { input, kind: found.kind };
    node = node.parentElement;
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The page has two hidden file inputs and may use a different one for the primary and for the other
 * applicants. Clicking the upload area makes the page open the input it really uses; we catch that
 * click, cancel the file dialog and return that input.
 */
export async function discoverUploadInput(doc: Document): Promise<HTMLInputElement | null> {
  const found = findUploadLabel(doc);
  const area = found?.label.parentElement;
  if (!area) return null;

  let discovered = null as HTMLInputElement | null;
  const listener = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file') {
      discovered = target;
      event.preventDefault(); // no file dialog
      event.stopPropagation();
    }
  };

  doc.addEventListener('click', listener, true);
  try {
    area.click();
    await sleep(60);
  } finally {
    doc.removeEventListener('click', listener, true);
  }
  return discovered;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64ToFile(base64: string, name: string): File {
  return new File([base64ToBytes(base64) as BlobPart], name, { type: 'application/pdf' });
}

/** Puts the file into the input the same way the file picker would */
export function assignFile(input: HTMLInputElement, file: File): void {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The upload area may only appear after a confirmation popup, so wait until it is really there */
export async function waitForUploadReady(doc: Document, timeoutMs = 15_000, pollMs = 250): Promise<boolean> {
  const started = Date.now();
  for (;;) {
    if (readApplicantCount(doc) !== null && findUploadInput(doc) !== null) return true;
    if (Date.now() - started >= timeoutMs) return false;
    await sleep(pollMs);
  }
}

export interface UploadOptions {
  assign?: (input: HTMLInputElement, file: File) => void;
  discover?: (doc: Document) => Promise<HTMLInputElement | null>;
  waitMs?: number;
  pollMs?: number;
  onProgress?: (done: number, total: number) => void;
  /** short plain-text notes for the activity log (never file names or contents) */
  onEvent?: (message: string) => void;
}

async function waitForCount(doc: Document, target: number, waitMs: number, pollMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < waitMs) {
    if (readApplicantCount(doc) === target) return true;
    await sleep(pollMs);
  }
  return readApplicantCount(doc) === target;
}

type StepResult = { ok: true } | { ok: false; reason: string };

/** Uploads ONE file at position `index` (0 = primary) and waits until the counter goes up by one */
async function uploadOne(
  doc: Document,
  file: UploadFile,
  index: number,
  options: UploadOptions
): Promise<StepResult> {
  const fail = (reason: string): StepResult => ({ ok: false, reason });
  const waitMs = options.waitMs ?? 30_000;
  const pollMs = options.pollMs ?? 250;

  const target = findUploadInput(doc);
  if (!target) return fail('The upload field was not found.');

  const expected = index === 0 ? 'primary' : 'other';
  if (target.kind !== expected) {
    return fail(`The page asks for the ${target.kind} applicant's file but file ${index + 1} is the ${expected} one.`);
  }

  const before = readApplicantCount(doc);
  if (before !== index) {
    return fail(`Expected ${index} applicant(s) on the page but it shows ${before ?? 'no counter'}.`);
  }

  const discovered = await (options.discover ?? discoverUploadInput)(doc);
  const input = discovered ?? target.input;
  const all = Array.from(doc.querySelectorAll('input[type="file"]'));
  options.onEvent?.(
    `File ${index + 1}: using ${
      discovered ? 'the input the page itself opens' : 'the input next to the upload label'
    } (input ${all.indexOf(input) + 1} of ${all.length}).`
  );

  (options.assign ?? assignFile)(input, base64ToFile(file.dataBase64, file.name));

  if (!(await waitForCount(doc, index + 1, waitMs, pollMs))) {
    return fail(
      `The applicant counter did not go up after file ${index + 1} (waited ${Math.round(waitMs / 1000)} s).`
    );
  }
  return { ok: true };
}

/**
 * Uploads the files one by one, primary first. After each file the applicant counter on the page
 * must go up by exactly one before the next file is sent. Stops at the first surprise.
 */
export async function uploadFilesSerially(
  doc: Document,
  files: UploadFile[],
  options: UploadOptions = {}
): Promise<UploadOutcome> {
  const total = files.length;
  const fail = (uploaded: number, reason: string): UploadOutcome => ({ ok: false, uploaded, total, reason });

  if (total === 0) return fail(0, 'There are no verified files to upload.');

  const start = readApplicantCount(doc);
  if (start === null) return fail(0, 'Could not read the applicant counter on the page.');

  if (start !== 0) {
    // already uploaded in full (for example after a page reload): nothing to do
    if (start === total) return { ok: true, uploaded: 0, total };
    return fail(0, `The page already shows ${start} applicant(s) but ${total} verified file(s) are saved. Please continue manually.`);
  }

  for (let i = 0; i < total; i++) {
    const result = await uploadOne(doc, files[i] as UploadFile, i, options);
    if (!result.ok) return fail(i, result.reason);
    options.onProgress?.(i + 1, total);
  }

  return { ok: true, uploaded: total, total };
}

export interface UploadPageState {
  count: number | null;
  slot: 'primary' | 'other' | null;
}

export function getUploadState(doc: Document): UploadPageState {
  return { count: readApplicantCount(doc), slot: findUploadLabel(doc)?.kind ?? null };
}

/**
 * Manual upload of one saved file (the icon in the popup). Files must go in order, so only the next
 * file in line is accepted: that keeps the primary file primary and never uploads a file twice.
 */
export async function injectFile(
  doc: Document,
  file: UploadFile & { index: number },
  options: UploadOptions = {}
): Promise<StepResult> {
  const count = readApplicantCount(doc);
  if (count === null) {
    return { ok: false, reason: 'Could not read the applicant counter. Open the file upload page (and confirm its popup) first.' };
  }
  if (file.index < count) {
    return { ok: false, reason: `This file is already uploaded (the page shows ${count} applicant(s)).` };
  }
  if (file.index > count) {
    return { ok: false, reason: `Upload file ${count + 1} first. Files must go in order, primary first.` };
  }
  return uploadOne(doc, file, file.index, options);
}