/**
 * Encryption utilities for secure credential storage
 * Uses Web Crypto API for AES-GCM encryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Derive encryption key from master password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  return { key, salt };
}

/**
 * Encrypt text data using AES-GCM
 */
export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    dataBuffer
  );

  return {
    encrypted: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToBuffer(encrypted);
  const ivBuffer = base64ToBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: ivBuffer,
    },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Export key to base64 for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exported);
}

/**
 * Import key from base64
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToBuffer(keyData);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Hash data using SHA-256
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return bufferToBase64(hashBuffer);
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

/**
 * Generate a random ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}
