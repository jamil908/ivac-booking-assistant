/**
 * Encrypted storage for BGD web files (PDF) per profile.
 * - first file = primary applicant, the others = secondary (by position)
 * - everything (name, size, bytes) is encrypted with the same session key as the credentials
 * - only a "verified" prefix of files is ever handed out for upload
 */
import { getEncryptionKey } from '../security/lock';
import { generateId } from '../security/encryption';
import type { StoredFileInfo } from '../types';

export const MAX_FILE_BYTES = 500 * 1024;
export const MAX_FILES_PER_PROFILE = 4;

const INDEX_KEY = 'ivac_files_index';
const IV_LENGTH = 12;

interface FileMeta {
  name: string;
  size: number;
  lastModified?: number;
  addedAt: number;
  verified: boolean;
}

interface StoredRecord {
  metaIv: string;
  meta: string;
  dataIv: string;
  data: string;
}

export interface UploadBundleFile {
  id: string;
  name: string;
  role: 'primary' | 'secondary';
  dataBase64: string;
}

const recordKey = (profileId: string, fileId: string) => `ivac_file:${profileId}:${fileId}`;

// base64 helpers (the content script has its own copy: it must stay a standalone bundle)
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function requireKey(): Promise<CryptoKey> {
  const key = await getEncryptionKey();
  if (!key) throw new Error('Unlock the extension before using saved files.');
  return key;
}

async function seal(bytes: Uint8Array, key: CryptoKey): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    bytes as BufferSource
  );
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) };
}

async function unseal(iv: string, data: string, key: CryptoKey): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) as BufferSource },
    key,
    base64ToBytes(data) as BufferSource
  );
  return new Uint8Array(plain);
}

export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').trim().slice(0, 100);
  return base || 'webfile.pdf';
}

export function validatePdf(name: string, bytes: Uint8Array): void {
  if (!/\.pdf$/i.test(name)) throw new Error('Only PDF files are accepted.');
  if (bytes.length === 0) throw new Error('The file is empty.');
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error('The file is larger than 500KB, so IVAC would reject it.');
  }
  const header = String.fromCharCode(...bytes.subarray(0, 5));
  if (header !== '%PDF-') throw new Error('This does not look like a real PDF file.');
}

async function readIndex(): Promise<Record<string, string[]>> {
  const stored = await chrome.storage.local.get(INDEX_KEY);
  return (stored[INDEX_KEY] as Record<string, string[]> | undefined) ?? {};
}

async function readIds(profileId: string): Promise<string[]> {
  return (await readIndex())[profileId] ?? [];
}

async function safeSet(items: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.local.set(items);
  } catch {
    throw new Error('Could not save the file. Browser storage may be full.');
  }
}

async function writeIds(profileId: string, ids: string[]): Promise<void> {
  const index = await readIndex();
  if (ids.length > 0) index[profileId] = ids;
  else delete index[profileId];
  await safeSet({ [INDEX_KEY]: index });
}

async function loadRecord(profileId: string, fileId: string): Promise<StoredRecord | null> {
  const key = recordKey(profileId, fileId);
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as StoredRecord | undefined) ?? null;
}

async function readMeta(record: StoredRecord, key: CryptoKey): Promise<FileMeta> {
  const bytes = await unseal(record.metaIv, record.meta, key);
  return JSON.parse(new TextDecoder().decode(bytes)) as FileMeta;
}

async function buildRecord(meta: FileMeta, bytes: Uint8Array, key: CryptoKey): Promise<StoredRecord> {
  const sealedMeta = await seal(new TextEncoder().encode(JSON.stringify(meta)), key);
  const sealedData = await seal(bytes, key);
  return { metaIv: sealedMeta.iv, meta: sealedMeta.data, dataIv: sealedData.iv, data: sealedData.data };
}

async function rewriteMeta(
  profileId: string,
  fileId: string,
  key: CryptoKey,
  mutate: (meta: FileMeta) => FileMeta
): Promise<FileMeta> {
  const record = await loadRecord(profileId, fileId);
  if (!record) throw new Error('File not found.');
  const next = mutate(await readMeta(record, key));
  const sealed = await seal(new TextEncoder().encode(JSON.stringify(next)), key);
  await safeSet({ [recordKey(profileId, fileId)]: { ...record, metaIv: sealed.iv, meta: sealed.data } });
  return next;
}

function toInfo(id: string, meta: FileMeta, position: number): StoredFileInfo {
  return { id, ...meta, role: position === 0 ? 'primary' : 'secondary' };
}

/** Moving or deleting files changes who is "primary", so the affected files must be re-verified */
async function unverify(profileId: string, ids: string[], key: CryptoKey): Promise<void> {
  for (const id of ids) {
    await rewriteMeta(profileId, id, key, (meta) => (meta.verified ? { ...meta, verified: false } : meta));
  }
}

export async function listFiles(profileId: string): Promise<StoredFileInfo[]> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const result: StoredFileInfo[] = [];

  for (const id of ids) {
    const record = await loadRecord(profileId, id);
    if (!record) continue;
    result.push(toInfo(id, await readMeta(record, key), result.length));
  }
  return result;
}

export interface FileInput {
  name: string;
  lastModified?: number;
  dataBase64: string;
}

function decodeAndValidate(input: FileInput): { name: string; bytes: Uint8Array } {
  const name = sanitizeFileName(input.name);
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(input.dataBase64);
  } catch {
    throw new Error('The file data is not valid.');
  }
  validatePdf(name, bytes);
  return { name, bytes };
}

export async function addFile(profileId: string, input: FileInput): Promise<StoredFileInfo> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  if (ids.length >= MAX_FILES_PER_PROFILE) {
    throw new Error(`You can save at most ${MAX_FILES_PER_PROFILE} files per profile.`);
  }

  const { name, bytes } = decodeAndValidate(input);
  const meta: FileMeta = {
    name,
    size: bytes.length,
    lastModified: input.lastModified,
    addedAt: Date.now(),
    verified: false,
  };

  const id = generateId();
  await safeSet({ [recordKey(profileId, id)]: await buildRecord(meta, bytes, key) });
  await writeIds(profileId, [...ids, id]);
  return toInfo(id, meta, ids.length);
}

/** Replaces the content but keeps the position; it must be verified again */
export async function replaceFile(
  profileId: string,
  fileId: string,
  input: FileInput
): Promise<StoredFileInfo> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const position = ids.indexOf(fileId);
  if (position < 0) throw new Error('File not found.');

  const { name, bytes } = decodeAndValidate(input);
  const meta: FileMeta = {
    name,
    size: bytes.length,
    lastModified: input.lastModified,
    addedAt: Date.now(),
    verified: false,
  };
  await safeSet({ [recordKey(profileId, fileId)]: await buildRecord(meta, bytes, key) });
  return toInfo(fileId, meta, position);
}

export async function updateFile(
  profileId: string,
  fileId: string,
  patch: { name?: string; verified?: boolean }
): Promise<StoredFileInfo> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const position = ids.indexOf(fileId);
  if (position < 0) throw new Error('File not found.');

  const meta = await rewriteMeta(profileId, fileId, key, (current) => ({
    ...current,
    ...(patch.name !== undefined && { name: sanitizeFileName(patch.name) }),
    ...(patch.verified !== undefined && { verified: patch.verified }),
  }));
  return toInfo(fileId, meta, position);
}

export async function moveFile(
  profileId: string,
  fileId: string,
  direction: 'up' | 'down'
): Promise<StoredFileInfo[]> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const from = ids.indexOf(fileId);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return listFiles(profileId);

  const reordered = [...ids];
  [reordered[from], reordered[to]] = [reordered[to] as string, reordered[from] as string];
  await writeIds(profileId, reordered);
  await unverify(profileId, [ids[from] as string, ids[to] as string], key);
  return listFiles(profileId);
}

export async function deleteFile(profileId: string, fileId: string): Promise<StoredFileInfo[]> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const position = ids.indexOf(fileId);
  if (position < 0) throw new Error('File not found.');

  await chrome.storage.local.remove(recordKey(profileId, fileId));
  const remaining = ids.filter((id) => id !== fileId);
  await writeIds(profileId, remaining);
  // every file after the deleted one moved up a position
  await unverify(profileId, remaining.slice(position), key);
  return listFiles(profileId);
}

export async function deleteAllFiles(profileId: string): Promise<void> {
  const ids = await readIds(profileId);
  if (ids.length > 0) {
    await chrome.storage.local.remove(ids.map((id) => recordKey(profileId, id)));
  }
  await writeIds(profileId, []);
}

/**
 * Files that may be uploaded: the run of verified files starting at the primary.
 * An unverified file stops the run, so a verified file never jumps into the primary slot.
 */
export async function getUploadBundle(profileId: string): Promise<UploadBundleFile[]> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const bundle: UploadBundleFile[] = [];

  for (const id of ids) {
    const record = await loadRecord(profileId, id);
    if (!record) break;
    const meta = await readMeta(record, key);
    if (!meta.verified) break;

    const bytes = await unseal(record.dataIv, record.data, key);
    validatePdf(meta.name, bytes);
    bundle.push({
      id,
      name: meta.name,
      role: bundle.length === 0 ? 'primary' : 'secondary',
      dataBase64: bytesToBase64(bytes),
    });
  }
  return bundle;
}

/** One verified file by id, with its position (0 = primary). Used for manual upload from the popup. */
export async function getVerifiedFile(
  profileId: string,
  fileId: string
): Promise<UploadBundleFile & { index: number }> {
  const key = await requireKey();
  const ids = await readIds(profileId);
  const index = ids.indexOf(fileId);
  if (index < 0) throw new Error('File not found.');

  const record = await loadRecord(profileId, fileId);
  if (!record) throw new Error('File not found.');

  const meta = await readMeta(record, key);
  if (!meta.verified) {
    throw new Error('This file is not marked Verified. Tick Verified in Options > Files first.');
  }

  const bytes = await unseal(record.dataIv, record.data, key);
  validatePdf(meta.name, bytes);
  return {
    id: fileId,
    name: meta.name,
    role: index === 0 ? 'primary' : 'secondary',
    index,
    dataBase64: bytesToBase64(bytes),
  };
}