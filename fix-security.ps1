
$ErrorActionPreference = "Stop"

$Project = "D:\ivac-extention"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Project "security-patch-backup-$Stamp"

if (!(Test-Path (Join-Path $Project "src\storage\index.ts"))) {
    throw "Project not found: $Project"
}
if (!(Test-Path (Join-Path $Project "src\background\index.ts"))) {
    throw "Background source not found."
}

Set-Location $Project
New-Item -ItemType Directory -Path $Backup -Force | Out-Null

$StoragePath = Join-Path $Project "src\storage\index.ts"
$BackgroundPath = Join-Path $Project "src\background\index.ts"

$StorageOriginal = Get-Content $StoragePath -Raw
$BackgroundOriginal = Get-Content $BackgroundPath -Raw

# Replace a uniquely identified section. Never write partial changes.
function Replace-Section {
    param(
        [string]$Content,
        [string]$StartMarker,
        [string]$EndMarker,
        [string]$Replacement,
        [string]$Label
    )

    $start = $Content.IndexOf($StartMarker)
    if ($start -lt 0) { throw "Cannot find section start: $Label" }

    $end = $Content.IndexOf($EndMarker, $start + $StartMarker.Length)
    if ($end -lt 0) { throw "Cannot find section end: $Label" }

    $after = $end
    return $Content.Substring(0, $start) +
        $Replacement +
        $Content.Substring($after)
}

# Prepare changes in memory first.
$Storage = $StorageOriginal
$Background = $BackgroundOriginal

if ($Storage -notmatch "getEncryptionKey") {
    $Storage = $Storage.Replace(
        "import { encryptData, decryptData, generateId } from '../security/encryption';",
        "import { encryptData, decryptData, generateId } from '../security/encryption';`r`nimport { getEncryptionKey } from '../security/lock';"
    )
}

$Storage = Replace-Section `
    $Storage `
    "/**`r`n * Get all profiles`r`n */" `
    "/**`r`n * Save profile (create or update)`r`n */" `
@'
/**
 * Get all profiles. Credentials are decrypted only while unlocked.
 */
export async function getProfiles(): Promise<ApplicantProfile[]> {
  const data = await getStorageData();
  const profiles = Object.values(data?.profiles ?? {});
  return Promise.all(profiles.map((profile) => decryptProfileCredentials(profile)));
}

/**
 * Get profile by ID. Credentials are decrypted only while unlocked.
 */
export async function getProfile(id: string): Promise<ApplicantProfile | null> {
  const data = await getStorageData();
  const profile = data?.profiles[id];
  return profile ? decryptProfileCredentials(profile) : null;
}

'@ `
    "profile read functions"

$Storage = Replace-Section `
    $Storage `
    "/**`r`n * Save profile (create or update)`r`n */" `
    "/**`r`n * Delete profile`r`n */" `
@'
/**
 * Save profile. Keep plaintext only in the returned in-memory object;
 * persist encrypted credentials in chrome.storage.local.
 */
export async function saveProfile(
  profile: Omit<ApplicantProfile, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
): Promise<ApplicantProfile> {
  const data = await getStorageData();
  const now = new Date().toISOString();

  const newProfile: ApplicantProfile = {
    ...profile,
    id: id ?? generateId(),
    createdAt: id ? (data?.profiles[id]?.createdAt ?? now) : now,
    updatedAt: now,
  };

  const encryptedProfile = await encryptProfileCredentials(newProfile);
  const updatedProfiles = {
    ...data?.profiles,
    [newProfile.id]: encryptedProfile,
  };

  await setStorageData({ profiles: updatedProfiles });
  return newProfile;
}

'@ `
    "profile save function"

$Storage = Replace-Section `
    $Storage `
    "/**`r`n * Encrypt sensitive profile data`r`n */" `
    "/**`r`n * Get default settings`r`n */" `
@'
/**
 * Encrypt IVAC credentials using the active master-password-derived session key.
 * Ciphertext format: enc:<ciphertext-base64>:<iv-base64>
 */
export async function encryptProfileCredentials(
  profile: ApplicantProfile
): Promise<ApplicantProfile> {
  const username = profile.ivacUsername;
  const password = profile.ivacPassword;

  if ((!username || username.startsWith('enc:')) &&
      (!password || password.startsWith('enc:'))) {
    return profile;
  }

  const key = await getEncryptionKey();
  if (!key) {
    throw new Error('Extension is locked. Unlock before saving IVAC credentials.');
  }

  const result: ApplicantProfile = { ...profile };

  if (username && !username.startsWith('enc:')) {
    const encrypted = await encryptData(username, key);
    result.ivacUsername = `enc:${encrypted.encrypted}:${encrypted.iv}`;
  }

  if (password && !password.startsWith('enc:')) {
    const encrypted = await encryptData(password, key);
    result.ivacPassword = `enc:${encrypted.encrypted}:${encrypted.iv}`;
  }

  return result;
}

/**
 * Decrypt stored IVAC credentials with the current session key.
 */
export async function decryptProfileCredentials(
  profile: ApplicantProfile
): Promise<ApplicantProfile> {
  const username = profile.ivacUsername;
  const password = profile.ivacPassword;

  const hasEncryptedCredentials =
    Boolean(username?.startsWith('enc:')) ||
    Boolean(password?.startsWith('enc:'));

  if (!hasEncryptedCredentials) {
    return profile;
  }

  const key = await getEncryptionKey();
  if (!key) {
    throw new Error('Extension is locked. Unlock before accessing IVAC credentials.');
  }

  const result: ApplicantProfile = { ...profile };

  const decryptField = async (value: string | undefined): Promise<string | undefined> => {
    if (!value?.startsWith('enc:')) return value;

    const parts = value.split(':');
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      throw new Error('Stored credential format is invalid.');
    }

    return decryptData(parts[1], parts[2], key);
  };

  result.ivacUsername = await decryptField(username);
  result.ivacPassword = await decryptField(password);

  return result;
}

'@ `
    "credential encryption functions"

# Expand lock checks for operations that access or change booking state.
$oldOps = @'
  const sensitiveOps = [
    'GET_PROFILES',
    'SAVE_PROFILE',
    'DELETE_PROFILE',
    'GET_BOOKING_STATE',
    'AUTOFILL_LOGIN',
    'SUBMIT_OTP',
  ];
'@

$newOps = @'
  const sensitiveOps = [
    'GET_PROFILES',
    'SAVE_PROFILE',
    'DELETE_PROFILE',
    'SET_ACTIVE_PROFILE',
    'GET_BOOKING_STATE',
    'GET_ALL_BOOKING_STATES',
    'UPDATE_BOOKING_STATE',
    'RESET_BOOKING',
    'AUTOFILL_LOGIN',
    'REQUEST_OTP',
    'SUBMIT_OTP',
    'CREATE_BOOKING_WINDOW',
    'PAUSE_BOOKING',
    'RESUME_BOOKING',
    'CLEAR_ALL_DATA',
  ];
'@

if (!$Background.Contains($oldOps)) {
    throw "Cannot safely locate sensitiveOps block. No source files have been changed."
}
$Background = $Background.Replace($oldOps, $newOps)

# Do not refresh activity while the extension is locked.
$oldActivity = @'
  // Update activity timestamp for non-sensitive operations
  if (message.type !== 'CHECK_LOCK_STATUS') {
    await updateLastActivity();
  }

  // Check if locked for sensitive operations
'@

$newActivity = @'
  // Check lock state before recording activity.
'@

if (!$Background.Contains($oldActivity)) {
    throw "Cannot safely locate activity/lock block. No source files have been changed."
}
$Background = $Background.Replace($oldActivity, $newActivity)

$lockEnd = @'
  if (locked && sensitiveOps.includes(message.type)) {
    throw new Error('Extension is locked. Please unlock to continue.');
  }

'@

$lockEndNew = @'
  if (locked && sensitiveOps.includes(message.type)) {
    throw new Error('Extension is locked. Please unlock to continue.');
  }

  if (!locked && message.type !== 'CHECK_LOCK_STATUS' &&
      message.type !== 'UNLOCK_EXTENSION' &&
      message.type !== 'SET_MASTER_PASSWORD' &&
      message.type !== 'LOCK_EXTENSION') {
    await updateLastActivity();
  }

'@

if (!$Background.Contains($lockEnd)) {
    throw "Cannot safely locate lock gate. No source files have been changed."
}
$Background = $Background.Replace($lockEnd, $lockEndNew)

# Save originals, then apply both prepared files.
Copy-Item $StoragePath (Join-Path $Backup "storage-index.ts")
Copy-Item $BackgroundPath (Join-Path $Backup "background-index.ts")

Set-Content -Path $StoragePath -Value $Storage -Encoding utf8
Set-Content -Path $BackgroundPath -Value $Background -Encoding utf8

Write-Host "`nPatch applied. Backup: $Backup" -ForegroundColor Green

Write-Host "`nRunning tests..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed. Restore the two source files from: $Backup" -ForegroundColor Red
    exit 1
}

Write-Host "`nRunning TypeScript check..." -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "Typecheck failed. Review the errors before building." -ForegroundColor Red
    exit 1
}

Write-Host "`nBuilding extension..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Review the errors before using the extension." -ForegroundColor Red
    exit 1
}

Write-Host "`nPatch, tests, typecheck, and build completed." -ForegroundColor Green
