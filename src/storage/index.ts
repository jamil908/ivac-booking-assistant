/**
 * Secure storage layer using chrome.storage.local
 * Handles encryption/decryption of sensitive data
 */

import type { ApplicantProfile, BookingState, ExtensionSettings, StorageData } from '../types';
import { encryptData, decryptData, generateId } from '../security/encryption';
import { getEncryptionKey } from '../security/lock';
const STORAGE_KEY = 'ivac_data';

/**
 * Initialize storage with default settings
 */
export async function initializeStorage(): Promise<void> {
  const data = await getStorageData();
  if (!data) {
    await setStorageData({
      profiles: {},
      bookingStates: {},
      settings: getDefaultSettings(),
      isLocked: true, // Default to locked
    });
  }
}

/**
 * Get all storage data
 */
async function getStorageData(): Promise<StorageData | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY];
  if (!data || typeof data !== 'object') return null;
  return data as StorageData;
}

/**
 * Set storage data
 */
async function setStorageData(data: Partial<StorageData>): Promise<void> {
  const current = await getStorageData();
  const updated = { ...current, ...data };
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
}

/**
 * Get all profiles
 */
/**
 * Get all profiles, decrypting credentials only while unlocked.
 */
export async function getProfiles(): Promise<ApplicantProfile[]> {
  const data = await getStorageData();
  const profiles = Object.values(data?.profiles ?? {});

  const result: ApplicantProfile[] = [];

  for (const profile of profiles) {
    result.push(await readAndMigrateProfile(profile));
  }

  return result;
}

/**
 * Get a profile by ID.
 */
export async function getProfile(
  id: string
): Promise<ApplicantProfile | null> {
  const data = await getStorageData();
  const profile = data?.profiles?.[id];

  if (!profile) return null;

  return readAndMigrateProfile(profile);
}

/**
 * Save a profile with encrypted IVAC credentials.
 */
export async function saveProfile(
  profile: Omit<ApplicantProfile, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
): Promise<ApplicantProfile> {
  const data = await getStorageData();
  const now = new Date().toISOString();
  const existing = id ? data?.profiles?.[id] : undefined;

  const newProfile: ApplicantProfile = {
    ...profile,
    // Preserve existing credentials if the caller omits them.
    ivacUsername:
      profile.ivacUsername === undefined
        ? existing?.ivacUsername
        : profile.ivacUsername,
    ivacPassword:
      profile.ivacPassword === undefined
        ? existing?.ivacPassword
        : profile.ivacPassword,
    id: id ?? generateId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const protectedProfile = await encryptCredentialsForStorage(newProfile);

  const updatedProfiles = {
    ...data?.profiles,
    [protectedProfile.id]: protectedProfile,
  };

  await setStorageData({ profiles: updatedProfiles });

  // Return the caller's plaintext profile, not encrypted values.
  return {
    ...newProfile,
    ivacUsername:
      profile.ivacUsername === undefined
        ? await decryptStoredCredential(existing?.ivacUsername)
        : profile.ivacUsername,
    ivacPassword:
      profile.ivacPassword === undefined
        ? await decryptStoredCredential(existing?.ivacPassword)
        : profile.ivacPassword,
  };
}

/**
 * Encrypt credentials using the current unlocked session key.
 */
async function encryptCredentialsForStorage(
  profile: ApplicantProfile
): Promise<ApplicantProfile> {
  const username = profile.ivacUsername;
  const password = profile.ivacPassword;

  const needsEncryption = [username, password].some(
    (value) => typeof value === 'string' && value.length > 0 &&
      !value.startsWith('enc:')
  );

  const needsDecryptionKey = [username, password].some(
    (value) => typeof value === 'string' && value.startsWith('enc:')
  );

  if (!needsEncryption && !needsDecryptionKey) {
    return profile;
  }

  const key = await getEncryptionKey();

  if (!key) {
    throw new Error('Unlock the extension before accessing credentials.');
  }

  return {
    ...profile,
    ivacUsername: await encryptCredential(username, key),
    ivacPassword: await encryptCredential(password, key),
  };
}

/**
 * Read a stored profile and migrate legacy plaintext credentials.
 */
async function readAndMigrateProfile(
  profile: ApplicantProfile
): Promise<ApplicantProfile> {
  const username = profile.ivacUsername;
  const password = profile.ivacPassword;

  const hasCredentials = [username, password].some(
    (value) => typeof value === 'string' && value.length > 0
  );

  if (!hasCredentials) return profile;

  const key = await getEncryptionKey();

  if (!key) {
    throw new Error('Unlock the extension before accessing credentials.');
  }

  const decrypted: ApplicantProfile = {
    ...profile,
    ivacUsername: await decryptCredential(username, key),
    ivacPassword: await decryptCredential(password, key),
  };

  const migrated = await encryptCredentialsForStorage(decrypted);

  // Save migrated credentials only if legacy plaintext was present.
  if (
    migrated.ivacUsername !== username ||
    migrated.ivacPassword !== password
  ) {
    const data = await getStorageData();

    await setStorageData({
      profiles: {
        ...data?.profiles,
        [profile.id]: {
          ...profile,
          ivacUsername: migrated.ivacUsername,
          ivacPassword: migrated.ivacPassword,
        },
      },
    });
  }

  return decrypted;
}

async function encryptCredential(
  value: string | undefined,
  key: CryptoKey
): Promise<string | undefined> {
  if (!value) return value;

  if (value.startsWith('enc:')) {
    return value;
  }

  const result = await encryptData(value, key);
  return `enc:${result.encrypted}:${result.iv}`;
}

async function decryptCredential(
  value: string | undefined,
  key: CryptoKey
): Promise<string | undefined> {
  if (!value || !value.startsWith('enc:')) return value;

  const parts = value.split(':');

  if (parts.length !== 3 || !parts[1] || !parts[2]) {
    throw new Error('Stored credential has an invalid format.');
  }

  return decryptData(parts[1], parts[2], key);
}

async function decryptStoredCredential(
  value: string | undefined
): Promise<string | undefined> {
  if (!value || !value.startsWith('enc:')) return value;

  const key = await getEncryptionKey();

  if (!key) {
    throw new Error('Unlock the extension before accessing credentials.');
  }

  return decryptCredential(value, key);
}

/**
 * Delete profile
 */
export async function deleteProfile(id: string): Promise<void> {
  const data = await getStorageData();
  if (!data) return;

  const { [id]: removed, ...remaining } = data.profiles;
  await setStorageData({ profiles: remaining });

  // Clear active profile if it was deleted
  if (data.activeProfileId === id) {
    await setStorageData({ activeProfileId: undefined });
  }
}

/**
 * Get active profile ID
 */
export async function getActiveProfileId(): Promise<string | null> {
  const data = await getStorageData();
  return data?.activeProfileId ?? null;
}

/**
 * Set active profile
 */
export async function setActiveProfile(id: string): Promise<void> {
  const profile = await getProfile(id);
  if (!profile) {
    throw new Error('Profile not found');
  }

  // Update last used timestamp
  await saveProfile(profile, id);
  await setStorageData({ activeProfileId: id });
}

/**
 * Get booking state for a specific profile/window
 */
export async function getBookingState(profileId: string): Promise<BookingState | null> {
  const data = await getStorageData();
  return data?.bookingStates[profileId] ?? null;
}

/**
 * Get all booking states
 */
export async function getAllBookingStates(): Promise<Record<string, BookingState>> {
  const data = await getStorageData();
  return data?.bookingStates ?? {};
}

/**
 * Update booking state for a specific profile
 */
export async function updateBookingState(
  profileId: string,
  state: Partial<BookingState>
): Promise<BookingState> {
  const data = await getStorageData();
  const current = data?.bookingStates[profileId];
  const now = new Date().toISOString();

  const newState: BookingState = {
    ...current,
    ...state,
    profileId,
    updatedAt: now,
    lastActivityAt: now,
    createdAt: current?.createdAt ?? now,
    isPaused: state.isPaused ?? current?.isPaused ?? false,
    needsManualAction: state.needsManualAction ?? current?.needsManualAction ?? false,
    loginAttempts: state.loginAttempts ?? current?.loginAttempts ?? 0,
    otpRequested: state.otpRequested ?? current?.otpRequested ?? false,
    documentsUploaded: state.documentsUploaded ?? current?.documentsUploaded ?? [],
    errors: state.errors ?? current?.errors ?? [],
  } as BookingState;

  const updatedStates = {
    ...data?.bookingStates,
    [profileId]: newState,
  };

  await setStorageData({ bookingStates: updatedStates });
  return newState;
}

/**
 * Reset booking state for a specific profile
 */
export async function resetBookingState(profileId: string): Promise<void> {
  const data = await getStorageData();
  if (!data) return;

  const { [profileId]: removed, ...remaining } = data.bookingStates;
  await setStorageData({ bookingStates: remaining });
}

/**
 * Get settings
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const data = await getStorageData();
  return data?.settings ?? getDefaultSettings();
}

/**
 * Update settings
 */
export async function updateSettings(
  settings: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await setStorageData({ settings: updated });
  return updated;
}

/**
 * Encrypt sensitive profile data
 */
export async function encryptProfileCredentials(
  profile: ApplicantProfile,
  masterPassword: string
): Promise<ApplicantProfile> {
  if (!profile.ivacUsername || !profile.ivacPassword) {
    return profile;
  }

  // For demo purposes, we'll use a simplified encryption
  // In production, derive key from master password per user
  const { deriveKeyFromPassword } = await import('../security/encryption');
  const { key } = await deriveKeyFromPassword(masterPassword);
  
  const usernameEncrypted = await encryptData(profile.ivacUsername, key);
  const passwordEncrypted = await encryptData(profile.ivacPassword, key);

  return {
    ...profile,
    ivacUsername: `enc:${usernameEncrypted.encrypted}:${usernameEncrypted.iv}`,
    ivacPassword: `enc:${passwordEncrypted.encrypted}:${passwordEncrypted.iv}`,
  };
}

/**
 * Decrypt sensitive profile data
 */
export async function decryptProfileCredentials(
  profile: ApplicantProfile,
  masterPassword: string
): Promise<ApplicantProfile> {
  if (
    !profile.ivacUsername?.startsWith('enc:') ||
    !profile.ivacPassword?.startsWith('enc:')
  ) {
    return profile;
  }

  const { deriveKeyFromPassword } = await import('../security/encryption');
  const { key } = await deriveKeyFromPassword(masterPassword);

  const [, usernameEnc, usernameIv] = profile.ivacUsername.split(':');
  const [, passwordEnc, passwordIv] = profile.ivacPassword.split(':');

  const username = await decryptData(usernameEnc!, usernameIv!, key);
  const password = await decryptData(passwordEnc!, passwordIv!, key);

  return {
    ...profile,
    ivacUsername: username,
    ivacPassword: password,
  };
}

/**
 * Get default settings
 */
function getDefaultSettings(): ExtensionSettings {
  return {
    autoFillEnabled: true,
    notificationsEnabled: true,
    requireOTPConfirmation: true,
    logLevel: 'info',
    theme: 'auto',
    inactivityLockMinutes: 15, // Auto-lock after 15 minutes
    maxConcurrentWindows: 3, // Limit parallel bookings
    sessionTimeoutMinutes: 30,
  };
}

/**
 * Clear all data (use with caution!)
 */
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
  await initializeStorage();
}
