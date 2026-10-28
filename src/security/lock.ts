/**
 * Extension lock/unlock mechanism
 * Implements user-controlled security with inactivity timeout
 */

import { deriveKeyFromPassword, exportKey, importKey } from './encryption';

const MASTER_PASSWORD_KEY = 'ivac_master_password_hash';
const ENCRYPTION_KEY_SESSION = 'ivac_encryption_key';
const LOCK_STATE_KEY = 'ivac_lock_state';
const LAST_ACTIVITY_KEY = 'ivac_last_activity';

export interface LockState {
  isLocked: boolean;
  hasPassword: boolean;
  lastActivity?: string;
}

/**
 * Initialize lock system with master password
 */
export async function setMasterPassword(password: string): Promise<void> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Derive key from password
  const { key, salt } = await deriveKeyFromPassword(password);
  
  // Store password hash (for verification)
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', passwordBuffer);
  const hashBase64 = bufferToBase64(hash);
  
  // Store hash and salt
  await chrome.storage.local.set({
    [MASTER_PASSWORD_KEY]: {
      hash: hashBase64,
      salt: bufferToBase64(salt.buffer as ArrayBuffer),
    },
  });

  // Store encryption key in session (memory only)
  const keyExport = await exportKey(key);
 await chrome.storage.session.set({
  [ENCRYPTION_KEY_SESSION]: keyExport,
});

  // Update lock state
  await updateLockState(false);
}

/**
 * Verify password and unlock extension
 */
export async function unlockExtension(password: string): Promise<boolean> {
  const result = await chrome.storage.local.get(MASTER_PASSWORD_KEY);
  const stored = result[MASTER_PASSWORD_KEY] as { hash: string; salt: string } | undefined;

  if (!stored) {
    throw new Error('No master password set. Please set a password first.');
  }

  // Verify password hash
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', passwordBuffer);
  const hashBase64 = bufferToBase64(hash);

  if (hashBase64 !== stored.hash) {
    return false; // Incorrect password
  }

  // Derive and store encryption key in session
  const salt = base64ToBuffer(stored.salt);
  const { key } = await deriveKeyFromPassword(password, new Uint8Array(salt));
  const keyExport = await exportKey(key);
 await chrome.storage.session.set({
  [ENCRYPTION_KEY_SESSION]: keyExport,
});

  // Update lock state
  await updateLockState(false);
  await updateLastActivity();

  return true;
}

/**
 * Lock the extension
 */
export async function lockExtension(): Promise<void> {
  // Clear session encryption key
  await chrome.storage.session.remove(ENCRYPTION_KEY_SESSION);

  // Update lock state
  await updateLockState(true);
}

/**
 * Check if extension is locked
 */
export async function isLocked(): Promise<boolean> {
  const result = await chrome.storage.local.get(LOCK_STATE_KEY);
  const state = result[LOCK_STATE_KEY] as LockState | undefined;
  return state?.isLocked ?? true; // Default to locked
}

/**
 * Check if master password is set
 */
export async function hasPassword(): Promise<boolean> {
  const result = await chrome.storage.local.get(MASTER_PASSWORD_KEY);
  return !!result[MASTER_PASSWORD_KEY];
}

/**
 * Get current encryption key (if unlocked)
 */
export async function getEncryptionKey(): Promise<CryptoKey | null> {
  const locked = await isLocked();
  if (locked) {
    return null;
  }
const result = await chrome.storage.session.get(ENCRYPTION_KEY_SESSION);
const keyExport = result[ENCRYPTION_KEY_SESSION] as string | undefined;

if (!keyExport) {
  return null;
}

  try {
    return await importKey(keyExport);
  } catch {
    return null;
  }
}

/**
 * Update lock state
 */
async function updateLockState(locked: boolean): Promise<void> {
  const hasPw = await hasPassword();
  const state: LockState = {
    isLocked: locked,
    hasPassword: hasPw,
    lastActivity: locked ? undefined : new Date().toISOString(),
  };

  await chrome.storage.local.set({ [LOCK_STATE_KEY]: state });
}

/**
 * Update last activity timestamp
 */
export async function updateLastActivity(): Promise<void> {
  const now = new Date().toISOString();
  await chrome.storage.local.set({ [LAST_ACTIVITY_KEY]: now });
}

/**
 * Check and enforce inactivity timeout
 */
export async function checkInactivityTimeout(timeoutMinutes: number): Promise<boolean> {
  if (timeoutMinutes <= 0) {
    return false; // Timeout disabled
  }

  const locked = await isLocked();
  if (locked) {
    return false; // Already locked
  }

  const result = await chrome.storage.local.get(LAST_ACTIVITY_KEY);
  const lastActivity = result[LAST_ACTIVITY_KEY] as string | undefined;

  if (!lastActivity) {
    // No activity recorded, lock now
    await lockExtension();
    return true;
  }

  const lastTime = new Date(lastActivity).getTime();
  const now = Date.now();
  const elapsed = (now - lastTime) / 1000 / 60; // minutes

  if (elapsed >= timeoutMinutes) {
    await lockExtension();
    return true;
  }

  return false;
}

/**
 * Clear master password (requires confirmation)
 */
export async function clearPassword(): Promise<void> {
  await lockExtension();
  await chrome.storage.local.remove([
    MASTER_PASSWORD_KEY,
    LOCK_STATE_KEY,
    LAST_ACTIVITY_KEY,
  ]);
}

/**
 * Get lock status
 */
export async function getLockStatus(): Promise<LockState> {
  const locked = await isLocked();
  const hasPw = await hasPassword();
  
  const result = await chrome.storage.local.get(LAST_ACTIVITY_KEY);
  const lastActivity = result[LAST_ACTIVITY_KEY] as string | undefined;

  return {
    isLocked: locked,
    hasPassword: hasPw,
    lastActivity,
  };
}

// Helper functions
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
