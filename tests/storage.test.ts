/**
 * Storage layer tests
 */
vi.mock('../src/security/lock', () => ({
  getEncryptionKey: vi.fn(),
}));

import { getEncryptionKey } from '../src/security/lock';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Chrome API
const mockStorage = {
  local: {
    data: {} as Record<string, unknown>,
    get: vi.fn((key: string) => {
      return Promise.resolve({ [key]: mockStorage.local.data[key] });
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(mockStorage.local.data, items);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      mockStorage.local.data = {};
      return Promise.resolve();
    }),
  },
  session: {
  data: {} as Record<string, unknown>,
  get: vi.fn((key: string) =>
    Promise.resolve({ [key]: mockStorage.session.data[key] })
  ),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(mockStorage.session.data, items);
    return Promise.resolve();
  }),
  remove: vi.fn((key: string) => {
    delete mockStorage.session.data[key];
    return Promise.resolve();
  }),
},
};

// @ts-ignore - Mock global chrome API
global.chrome = {
  storage: mockStorage,
} as any;

describe('Storage Layer', () => {
  beforeEach(() => {
  mockStorage.local.data = {};
  mockStorage.session.data = {};
});

  it('should initialize storage with default settings', async () => {
    const { initializeStorage, getSettings } = await import('../src/storage');
    
    await initializeStorage();
    const settings = await getSettings();
    
    expect(settings.autoFillEnabled).toBe(true);
    expect(settings.notificationsEnabled).toBe(true);
    expect(settings.requireOTPConfirmation).toBe(true);
  });

  it('should save and retrieve profiles', async () => {
    const { saveProfile, getProfile, getProfiles } = await import('../src/storage');
    
    const profileData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      passportNumber: 'AB123456',
      nationality: 'Test Country',
      dateOfBirth: '1990-01-01',
      visaType: 'tourist' as const,
      center: 'dhaka' as const,
      documents: [],
      preferredDates: [],
    };

    const saved = await saveProfile(profileData);
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Test User');

    const retrieved = await getProfile(saved.id);
    expect(retrieved?.name).toBe('Test User');
    expect(retrieved?.email).toBe('test@example.com');

    const allProfiles = await getProfiles();
    expect(allProfiles.length).toBe(1);
  });

  it('should update existing profile', async () => {
    const { saveProfile, getProfile } = await import('../src/storage');
    
    const profileData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      passportNumber: 'AB123456',
      nationality: 'Test Country',
      dateOfBirth: '1990-01-01',
      visaType: 'tourist' as const,
      center: 'dhaka' as const,
      documents: [],
      preferredDates: [],
    };

    const saved = await saveProfile(profileData);
    const updated = await saveProfile({ ...profileData, name: 'Updated Name' }, saved.id);
    
    expect(updated.id).toBe(saved.id);
    expect(updated.name).toBe('Updated Name');

    const retrieved = await getProfile(saved.id);
    expect(retrieved?.name).toBe('Updated Name');
  });

  it('should delete profile', async () => {
    const { saveProfile, deleteProfile, getProfile } = await import('../src/storage');
    
    const profileData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      passportNumber: 'AB123456',
      nationality: 'Test Country',
      dateOfBirth: '1990-01-01',
      visaType: 'tourist' as const,
      center: 'dhaka' as const,
      documents: [],
      preferredDates: [],
    };

    const saved = await saveProfile(profileData);
    await deleteProfile(saved.id);
    
    const retrieved = await getProfile(saved.id);
    expect(retrieved).toBeNull();
  });

  it('should manage active profile', async () => {
    const { saveProfile, setActiveProfile, getActiveProfileId } = await import('../src/storage');
    
    const profileData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      passportNumber: 'AB123456',
      nationality: 'Test Country',
      dateOfBirth: '1990-01-01',
      visaType: 'tourist' as const,
      center: 'dhaka' as const,
      documents: [],
      preferredDates: [],
    };

    const saved = await saveProfile(profileData);
    await setActiveProfile(saved.id);
    
    const activeId = await getActiveProfileId();
    expect(activeId).toBe(saved.id);
  });

  it('should update settings', async () => {
    const { initializeStorage, updateSettings, getSettings } = await import('../src/storage');
    
    await initializeStorage();
    await updateSettings({ autoFillEnabled: false });
    
    const settings = await getSettings();
    expect(settings.autoFillEnabled).toBe(false);
    expect(settings.notificationsEnabled).toBe(true); // unchanged
  });
});

describe('Encryption', () => {
  it('should generate unique IDs', async () => {
    const { generateId } = await import('../src/security/encryption');
    
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('should encrypt and decrypt data', async () => {
    const { encryptData, decryptData, deriveKeyFromPassword } = await import('../src/security/encryption');
    
    const password = 'test-password-123';
    const { key } = await deriveKeyFromPassword(password);
    
    const plaintext = 'sensitive data';
    const { encrypted, iv } = await encryptData(plaintext, key);
    
    expect(encrypted).toBeDefined();
    expect(iv).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
    
    const decrypted = await decryptData(encrypted, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', async () => {
    const { encryptData, deriveKeyFromPassword } = await import('../src/security/encryption');
    
    const password = 'test-password-123';
    const { key } = await deriveKeyFromPassword(password);
    
    const plaintext = 'same data';
    const result1 = await encryptData(plaintext, key);
    const result2 = await encryptData(plaintext, key);
    
    // Different IVs should produce different ciphertexts
    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });
});

describe('Credential security', () => {
  beforeEach(() => {
    vi.mocked(getEncryptionKey).mockReset();
    vi.mocked(getEncryptionKey).mockResolvedValue(null);
  });

  const profile = {
    name: 'Security Test',
    email: 'security@example.com',
    phone: '0123456789',
    passportNumber: 'AB123456',
    nationality: 'Bangladeshi',
    dateOfBirth: '1990-01-01',
    visaType: 'tourist' as const,
    center: 'dhaka' as const,
    documents: [],
    preferredDates: [],
    ivacUsername: 'test-user',
    ivacPassword: 'test-password',
  };

  it('should reject saving credentials while locked', async () => {
    const { saveProfile } = await import('../src/storage');

    await expect(saveProfile(profile)).rejects.toThrow(
      /unlock the extension/i
    );
  });

  it('should encrypt credentials before storing them', async () => {
    const { deriveKeyFromPassword } =
      await import('../src/security/encryption');
    const { saveProfile, getProfile } = await import('../src/storage');

    const { key } = await deriveKeyFromPassword('test-master-password');
    vi.mocked(getEncryptionKey).mockResolvedValue(key);

    const saved = await saveProfile(profile);
    const raw = mockStorage.local.data['ivac_data'] as any;
    const stored = raw.profiles[saved.id];

    expect(stored.ivacUsername).toMatch(/^enc:/);
    expect(stored.ivacPassword).toMatch(/^enc:/);

    const retrieved = await getProfile(saved.id);
    expect(retrieved?.ivacUsername).toBe('test-user');
    expect(retrieved?.ivacPassword).toBe('test-password');
  });

  it('should migrate legacy plaintext credentials when unlocked', async () => {
    const { deriveKeyFromPassword } =
      await import('../src/security/encryption');
    const { getProfile } = await import('../src/storage');

    const { key } = await deriveKeyFromPassword('test-master-password');
    vi.mocked(getEncryptionKey).mockResolvedValue(key);

    mockStorage.local.data['ivac_data'] = {
      profiles: {
        legacy: {
          ...profile,
          id: 'legacy',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      bookingStates: {},
      settings: {},
      isLocked: false,
    };

    const result = await getProfile('legacy');
    const raw = mockStorage.local.data['ivac_data'] as any;

    expect(result?.ivacPassword).toBe('test-password');
    expect(raw.profiles.legacy.ivacPassword).toMatch(/^enc:/);
  });
});