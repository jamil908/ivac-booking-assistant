/**
 * Extension lock/unlock mechanism
 * Implements user-controlled security with inactivity timeout
 */

import { deriveKeyFromPassword, exportKey, importKey } from './encryption';

const MASTER_PASSWORD_KEY = 'ivac_master_password_hash';
const ENCRYPTION_KEY_SESSION = 'ivac_encryption_key';
const LOCK_STATE_KEY = 'ivac_lock_state';
const LAST_ACTIVITY_KEY = 'ivac_last_activity';
const PASSWORD_VERIFIER_ITERATIONS = 600000;

interface StoredMasterPassword {
  version?: number;
  hash?: string;
  salt: string;
  verifier?: string;
  verifierSalt?: string;
}

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

  const existing = await chrome.storage.local.get(MASTER_PASSWORD_KEY);

  if (existing[MASTER_PASSWORD_KEY]) {
    throw new Error('Master password is already set.');
  }

  // Preserve existing encryption key derivation.
  const { key, salt } = await deriveKeyFromPassword(password);

  // Generate a separate salt for password verification.
  const verifierSalt = crypto.getRandomValues(new Uint8Array(16));

  const verifier = await derivePasswordVerifier(
    password,
    verifierSalt
  );

 await chrome.storage.local.set({
  [MASTER_PASSWORD_KEY]: {
    version: 2,
    salt: bufferToBase64(
  new Uint8Array(salt).buffer as ArrayBuffer
),
    verifier,
    verifierSalt: bufferToBase64(
      verifierSalt.buffer as ArrayBuffer
    ),
  },
});

  const keyExport = await exportKey(key);

  await chrome.storage.session.set({
    [ENCRYPTION_KEY_SESSION]: keyExport,
  });

  await updateLockState(false);
  await updateLastActivity();
}
/**
 * Verify password and unlock extension
 */
export async function unlockExtension(
  password: string
): Promise<boolean> {
  const result = await chrome.storage.local.get(MASTER_PASSWORD_KEY);

  const stored = result[MASTER_PASSWORD_KEY] as
    | StoredMasterPassword
    | undefined;

  if (!stored) {
    throw new Error(
      'No master password set. Please set a password first.'
    );
  }

  if (!stored.salt) {
    throw new Error('Invalid master password data.');
  }

  let verified = false;

  // New PBKDF2 verification
  if (
    stored.version === 2 &&
    stored.verifier &&
    stored.verifierSalt
  ) {
    const verifierSalt = new Uint8Array(
      base64ToBuffer(stored.verifierSalt)
    );

    const calculatedVerifier = await derivePasswordVerifier(
      password,
      verifierSalt
    );

    verified = constantTimeEqual(
      calculatedVerifier,
      stored.verifier
    );
  }

  // Legacy SHA-256 verification and automatic migration
  else if (stored.hash) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const hash = await crypto.subtle.digest(
      'SHA-256',
      passwordBuffer
    );

    const calculatedHash = bufferToBase64(hash);

    if (!constantTimeEqual(calculatedHash, stored.hash)) {
      return false;
    }

    // Generate new verifier without changing encryption salt.
    const verifierSalt = crypto.getRandomValues(
      new Uint8Array(16)
    );

    const verifier = await derivePasswordVerifier(
      password,
      verifierSalt
    );

    // Preserve the original salt used for AES encryption.
    await chrome.storage.local.set({
      [MASTER_PASSWORD_KEY]: {
        version: 2,
        salt: stored.salt,
        verifier,
        verifierSalt: bufferToBase64(
          verifierSalt.buffer as ArrayBuffer
        ),
      },
    });

    verified = true;
  }

  if (!verified) {
    return false;
  }

  // IMPORTANT: Keep original encryption derivation unchanged.
  const salt = base64ToBuffer(stored.salt);

  const { key } = await deriveKeyFromPassword(
    password,
    new Uint8Array(salt)
  );

  const keyExport = await exportKey(key);

  await chrome.storage.session.set({
    [ENCRYPTION_KEY_SESSION]: keyExport,
  });

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

async function derivePasswordVerifier(
  password: string,
  salt: Uint8Array
): Promise<string> {
  const encoder = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PASSWORD_VERIFIER_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  return bufferToBase64(derivedBits);
}

function constantTimeEqual(
  a: string,
  b: string
): boolean {
  const encoder = new TextEncoder();

  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < left.length; i++) {
    difference |= left[i]! ^ right[i]!;
  }

  return difference === 0;
}