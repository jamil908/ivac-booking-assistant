import { beforeEach, describe, expect, it, vi } from 'vitest';

const localData: Record<string, unknown> = {};
const sessionData: Record<string, unknown> = {};

const localStorageMock = {
  get: vi.fn(async (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      list.filter((key) => key in localData)
        .map((key) => [key, localData[key]])
    );
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(localData, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete localData[key];
    }
  }),
};

const sessionStorageMock = {
  get: vi.fn(async (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      list.filter((key) => key in sessionData)
        .map((key) => [key, sessionData[key]])
    );
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(sessionData, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete sessionData[key];
    }
  }),
};

vi.stubGlobal('chrome', {
  storage: {
    local: localStorageMock,
    session: sessionStorageMock,
  },
});

import {
  setMasterPassword,
  unlockExtension,
  lockExtension,
  isLocked,
} from '../src/security/lock';

const MASTER_KEY = 'ivac_master_password_hash';
const SESSION_KEY = 'ivac_encryption_key';

function toBase64(buffer: ArrayBuffer): string {
  return btoa(
    String.fromCharCode(...new Uint8Array(buffer))
  );
}

describe('Master Password Security', () => {
  beforeEach(() => {
    for (const key of Object.keys(localData)) {
      delete localData[key];
    }

    for (const key of Object.keys(sessionData)) {
      delete sessionData[key];
    }

    vi.clearAllMocks();
  });

  it('should create a Version 2 master password record', async () => {
    await setMasterPassword('TestPassword123');

    const record = localData[MASTER_KEY] as {
      version: number;
      salt: string;
      verifier: string;
      verifierSalt: string;
    };

    expect(record.version).toBe(2);
    expect(typeof record.salt).toBe('string');
    expect(typeof record.verifier).toBe('string');
    expect(typeof record.verifierSalt).toBe('string');
    expect(sessionData[SESSION_KEY]).toBeDefined();
    expect(await isLocked()).toBe(false);
  });

  it('should reject an incorrect password', async () => {
    await setMasterPassword('TestPassword123');
    await lockExtension();

    const result = await unlockExtension('WrongPassword123');

    expect(result).toBe(false);
    expect(await isLocked()).toBe(true);
    expect(sessionData[SESSION_KEY]).toBeUndefined();
  });

  it('should unlock with the correct password', async () => {
    await setMasterPassword('TestPassword123');
    await lockExtension();

    const result = await unlockExtension('TestPassword123');

    expect(result).toBe(true);
    expect(await isLocked()).toBe(false);
    expect(sessionData[SESSION_KEY]).toBeDefined();
  });

  it('should migrate a legacy password without changing encryption salt', async () => {
    const password = 'LegacyPassword123';
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password)
    );

    const originalSalt = toBase64(salt.buffer as ArrayBuffer);

    localData[MASTER_KEY] = {
      hash: toBase64(hash),
      salt: originalSalt,
    };

    localData['ivac_lock_state'] = {
      isLocked: true,
      hasPassword: true,
    };

    const result = await unlockExtension(password);

    const migrated = localData[MASTER_KEY] as {
      version: number;
      salt: string;
      verifier: string;
      verifierSalt: string;
    };

    expect(result).toBe(true);
    expect(migrated.version).toBe(2);
    expect(migrated.salt).toBe(originalSalt);
    expect(migrated.verifier).toBeDefined();
    expect(migrated.verifierSalt).toBeDefined();
    expect(await isLocked()).toBe(false);
  });

  it('should remove the session key when locking', async () => {
    await setMasterPassword('TestPassword123');

    expect(sessionData[SESSION_KEY]).toBeDefined();

    await lockExtension();

    expect(sessionData[SESSION_KEY]).toBeUndefined();
    expect(await isLocked()).toBe(true);
  });
});
