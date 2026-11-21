/**
 * Background service worker
 * Handles message passing, storage operations, and extension lifecycle
 */

import type { Message, MessageResponse, ApplicantProfile } from '../types';
import {
  initializeStorage,
  getProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
  setActiveProfile,
  getBookingState,
  getAllBookingStates,
  updateBookingState,
  resetBookingState,
  getSettings,
  updateSettings,
  clearAllData,
  getActiveProfileId,
} from '../storage';
import {
  isLocked,
  hasPassword,
  setMasterPassword,
  unlockExtension,
  lockExtension,
  getLockStatus,
  checkInactivityTimeout,
  updateLastActivity,
} from '../security/lock';
import {
  isTrustedInvoiceUrl,
  paymentStepFromResult,
  buildPaymentInfo,
  invoiceFilename,
} from '../payment/helpers';
import type { PaymentCheckResult } from '../payment/helpers';
import {
  listFiles,
  addFile,
  replaceFile,
  updateFile,
  moveFile,
  deleteFile,
  deleteAllFiles,
  getUploadBundle,
  getVerifiedFile,
} from '../storage/files';
import { appendLog, clearLog, getLog, sanitizeLogEntry } from '../storage/log';
// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('IVAC Assistant installed');
  await initializeStorage();
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.local.set({ ivac_automation_running: false });
});
// Check inactivity timeout periodically
chrome.alarms.create('checkInactivity', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkInactivity') {
    const settings = await getSettings();
    const timedOut = await checkInactivityTimeout(settings.inactivityLockMinutes);
    if (timedOut) {
      console.log('Extension locked due to inactivity');
    }
  }
});

// Handle messages from popup, options, and content scripts
chrome.runtime.onMessage.addListener((
  message: Message,
  sender,
  sendResponse: (response: MessageResponse) => void
) => {
  // Accept messages only from this extension's own pages
  const extensionOrigin = chrome.runtime.getURL('');

  const isExtensionPage =
    sender.id === chrome.runtime.id &&
    !!sender.url?.startsWith(extensionOrigin);

  const isTrustedContentScript =
    sender.id === chrome.runtime.id &&
    !!sender.tab?.id &&
    isTrustedIvacUrl(sender.url);

  if (!isExtensionPage && !isTrustedContentScript) {
    sendResponse({
      success: false,
      error: 'Unauthorized message sender.',
    });

    return false;
  }

  handleMessage(message, sender)
    .then((data) => {
      sendResponse({ success: true, data });
    })
    .catch((error) => {
      const text = error instanceof Error ? error.message : 'Unknown error';

      if (
        message?.type !== 'LOG_EVENT' &&
        message?.type !== 'GET_LOG' &&
        message?.type !== 'CLEAR_LOG'
      ) {
        const entry = sanitizeLogEntry({
          level: 'error',
          step: 'background',
          msg: `${message?.type}: ${text}`,
        });

        if (entry) void appendLog(entry);
      }

      sendResponse({
        success: false,
        error: text,
      });
    });

  return true;
});
function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function isAppointmentUrl(url: string | undefined): boolean {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' && parsed.hostname === 'appointment.ivacbd.com';
  } catch {
    return false;
  }
}
async function getAppointmentTabId(sender: chrome.runtime.MessageSender): Promise<number> {
  const tabId = await getIvacTabId(sender);
  const tab = await chrome.tabs.get(tabId);
  if (!isAppointmentUrl(tab.url)) {
    throw new Error('Open the IVAC appointment page (appointment.ivacbd.com) first.');
  }
  return tabId;
}

async function askAppointmentTab(tabId: number, message: { type: string; payload?: unknown }): Promise<unknown> {
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (!response?.success) {
    throw new Error(response?.error ?? 'The IVAC page did not answer. Reload the tab and try again.');
  }
  return response.data;
}
/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
    // Validate message before processing
  if (
    !message ||
    typeof message !== 'object' ||
    typeof message.type !== 'string'
  ) {
    throw new Error('Invalid extension message.');
  }

  console.log('Background received message:', message.type);

  // Check extension lock state
  const locked = await isLocked();

  // Only security lifecycle actions are allowed while locked
  const allowedWhileLocked = new Set<string>([
    'CHECK_LOCK_STATUS',
    'SET_MASTER_PASSWORD',
    'UNLOCK_EXTENSION',
    'LOCK_EXTENSION',
    'LOG_EVENT',
    'GET_LOG',
    'CLEAR_LOG',
  ]);


 
if (locked && !allowedWhileLocked.has(message.type)) {
  throw new Error(
    'Extension is locked. Please unlock to continue.'
  );
}

// Record activity only when the extension is already unlocked.
// Lock-management actions handle their own state transitions.
if (!locked && !allowedWhileLocked.has(message.type)) {
  await updateLastActivity();
}


  switch (message.type) {
    case 'SET_MASTER_PASSWORD': {
  if (await hasPassword()) {
    throw new Error('Master password is already set.');
  }

  const newPassword = message.payload as string;
  await setMasterPassword(newPassword);

  return true;
}
    case 'CHECK_LOCK_STATUS':
      return await getLockStatus();

    case 'UNLOCK_EXTENSION':
      return await unlockExtension(message.payload as string);

    case 'LOCK_EXTENSION':
      await lockExtension();
      return { success: true };

    case 'GET_PROFILES':
      return await getProfiles();

    case 'SAVE_PROFILE':
      return await saveProfile(
        message.payload as Omit<ApplicantProfile, 'id' | 'createdAt' | 'updatedAt'>,
        (message.payload as { id?: string })?.id
      );

    case 'DELETE_PROFILE':
      await deleteProfile(message.payload as string);
      await deleteAllFiles(message.payload as string);
      return { success: true };

    case 'SET_ACTIVE_PROFILE':
      await setActiveProfile(message.payload as string);
      return { success: true };

    case 'GET_BOOKING_STATE':
      return await getBookingState(message.payload as string);

    case 'GET_ALL_BOOKING_STATES':
      return await getAllBookingStates();

  
    case 'RESET_BOOKING':
      await resetBookingState(message.payload as string);
      return { success: true };

    case 'GET_SETTINGS':
      return await getSettings();

    case 'UPDATE_SETTINGS':
      return await updateSettings(message.payload as Parameters<typeof updateSettings>[0]);

   case 'AUTOFILL_LOGIN': {
  const tabId = await getIvacTabId(sender);

  return await handleAutofillLogin(
    tabId,
    message.payload as string
  );
}
case 'REQUEST_OTP': {
  const tabId = await getIvacTabId(sender);

  return await handleOTPRequest(
    tabId,
    message.payload as string
  );
}

case 'SUBMIT_OTP': {
  const tabId = await getIvacTabId(sender);

  return await handleOTPSubmit(
    tabId,
    message.payload as { profileId: string; otp: string }
  );
}
    case 'CHECK_PAYMENT_STATUS': {
  const tabId = await getIvacTabId(sender);
  return await handleCheckPayment(tabId, message.payload as string);
}

case 'SAVE_INVOICE': {
  const tabId = await getIvacTabId(sender);
  return await handleSaveInvoice(tabId, message.payload as string);
}
    case 'LOG_EVENT': {
      const entry = sanitizeLogEntry(message.payload);
      if (entry) await appendLog(entry);
      return true;
    }

    case 'GET_LOG':
      return await getLog();

    case 'CLEAR_LOG':
      await clearLog();
      return true;

    case 'GET_UPLOAD_STATE': {
      const tabId = await getAppointmentTabId(sender);
      return await askAppointmentTab(tabId, { type: 'GET_UPLOAD_STATE' });
    }

    case 'INJECT_FILE': {
      // only the extension's own pages (the popup) may start a manual upload
      if (!sender.url?.startsWith(chrome.runtime.getURL(''))) {
        throw new Error('Manual upload can only be started from the extension popup.');
      }
      const p = (message.payload ?? {}) as Record<string, unknown>;
      const fileId = requireText(p.fileId, 'file');
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('No active profile selected.');

      const tabId = await getAppointmentTabId(sender);
      const file = await getVerifiedFile(profileId, fileId);
      return await askAppointmentTab(tabId, { type: 'INJECT_FILE', payload: file });
    }
    case 'LIST_FILES':
      return await listFiles(requireText(message.payload, 'profile'));

    case 'ADD_FILE': {
      const p = (message.payload ?? {}) as Record<string, unknown>;
      return await addFile(requireText(p.profileId, 'profile'), {
        name: requireText(p.name, 'file name'),
        lastModified: typeof p.lastModified === 'number' ? p.lastModified : undefined,
        dataBase64: requireText(p.dataBase64, 'file data'),
      });
    }

    case 'REPLACE_FILE': {
      const p = (message.payload ?? {}) as Record<string, unknown>;
      return await replaceFile(requireText(p.profileId, 'profile'), requireText(p.fileId, 'file'), {
        name: requireText(p.name, 'file name'),
        lastModified: typeof p.lastModified === 'number' ? p.lastModified : undefined,
        dataBase64: requireText(p.dataBase64, 'file data'),
      });
    }

    case 'UPDATE_FILE': {
      const p = (message.payload ?? {}) as Record<string, unknown>;
      return await updateFile(requireText(p.profileId, 'profile'), requireText(p.fileId, 'file'), {
        ...(typeof p.name === 'string' && { name: p.name }),
        ...(typeof p.verified === 'boolean' && { verified: p.verified }),
      });
    }

    case 'MOVE_FILE': {
      const p = (message.payload ?? {}) as Record<string, unknown>;
      if (p.direction !== 'up' && p.direction !== 'down') throw new Error('Invalid direction.');
      return await moveFile(requireText(p.profileId, 'profile'), requireText(p.fileId, 'file'), p.direction);
    }

    case 'DELETE_FILE': {
      const p = (message.payload ?? {}) as Record<string, unknown>;
      return await deleteFile(requireText(p.profileId, 'profile'), requireText(p.fileId, 'file'));
    }

    case 'GET_UPLOAD_FILES': {
      // the saved PDFs may only be sent to the IVAC appointment page
      if (!isAppointmentUrl(sender.url)) {
        throw new Error('Saved files can only be sent to the IVAC appointment page.');
      }
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('No active profile selected.');
      return await getUploadBundle(profileId);
    }
    case 'CLEAR_ALL_DATA':
      await clearAllData();
      return { success: true };

    case 'CREATE_BOOKING_WINDOW':
      return await createBookingWindow(message.payload as string);

    case 'PAUSE_BOOKING':
      return await pauseBooking(message.payload as string);

    case 'RESUME_BOOKING':
      return await resumeBooking(message.payload as string);

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Handle login autofill request
 */
async function handleAutofillLogin(tabId: number | undefined, profileId: string): Promise<{ success: boolean }> {
  if (!tabId) {
    throw new Error('No tab ID provided');
  }

  const profile = await getProfile(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  // Send credentials to content script
  await chrome.tabs.sendMessage(tabId, {
    type: 'FILL_LOGIN',
    payload: {
      username: profile.ivacUsername,
      password: profile.ivacPassword,
    },
  });

  // Update booking state
  await updateBookingState(profileId, {
    currentStep: 'login_submitted',
    tabId,
  });

  return { success: true };
}


function isTrustedIvacUrl(url?: string): boolean {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.protocol === 'https:' &&
      (
        parsedUrl.hostname === 'ivacbd.com' ||
        parsedUrl.hostname.endsWith('.ivacbd.com')
      )
    );
  } catch {
    return false;
  }
}

async function getIvacTabId(
  sender: chrome.runtime.MessageSender
): Promise<number> {
  // Content script থেকে এলে তার নিজের tab
  if (sender.tab?.id !== undefined && isTrustedIvacUrl(sender.tab.url)) {
    return sender.tab.id;
  }

  // Popup বা detached window থেকে এলে সাধারণ window-গুলোর active tab থেকে IVAC tab খোঁজো
  const tabs = await chrome.tabs.query({ active: true, windowType: 'normal' });
  const ivacTab = tabs.find((tab) => isTrustedIvacUrl(tab.url));

  if (ivacTab?.id === undefined) {
    throw new Error('Please open the official IVAC website first.');
  }

  return ivacTab.id;
}
/**
 * Handle OTP request
 */
/**
 * Handle OTP request
 */
async function handleOTPRequest(
  tabId: number | undefined,
  profileId: string
): Promise<{ success: boolean }> {
  if (
    !tabId ||
    typeof profileId !== 'string' ||
    !profileId.trim()
  ) {
    throw new Error('Invalid tab or profile ID');
  }

  const profile = await getProfile(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  const settings = await getSettings();

  if (settings.notificationsEnabled) {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon48.png',
      title: 'OTP Required',
      message: 'Please check your phone/email for OTP and enter it in the extension popup.',
      priority: 2,
    });
  }

  const otpExpiresAt = new Date(
    Date.now() + 5 * 60 * 1000
  ).toISOString();

  await updateBookingState(profileId, {
    tabId,
    currentStep: 'otp_required',
    otpRequested: true,
    otpExpiresAt,
    needsManualAction: true,
    manualActionMessage: 'Please enter the OTP you received',
  });

  return { success: true };
}

/**
 * Handle OTP submission
 */
async function handleOTPSubmit(
  tabId: number | undefined,
  payload: { profileId: string; otp: string }
): Promise<{ success: boolean }> {
  if (!tabId) {
    throw new Error('No tab ID provided');
  }

  if (
    !payload ||
    typeof payload.profileId !== 'string' ||
    !payload.profileId.trim() ||
    typeof payload.otp !== 'string' ||
    !/^\d{4,6}$/.test(payload.otp)
  ) {
    throw new Error('Invalid profile ID or OTP format');
  }

  const { profileId, otp } = payload;

  const state = await getBookingState(profileId);

  if (!state || !state.otpRequested) {
    throw new Error('No pending OTP request found');
  }

  if (state.tabId !== tabId) {
    throw new Error('OTP does not belong to this browser tab');
  }

  const expiryTime = state.otpExpiresAt
    ? Date.parse(state.otpExpiresAt)
    : NaN;

  if (
    !Number.isFinite(expiryTime) ||
    Date.now() >= expiryTime
  ) {
    throw new Error('OTP has expired. Please request a new OTP.');
  }

    const response = await chrome.tabs.sendMessage(tabId, {
    type: 'SUBMIT_OTP',
    payload: { otp },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? 'Could not send OTP to the IVAC page');
  }

  // OTP is filled, but authentication is NOT confirmed.
  await updateBookingState(profileId, {
    currentStep: 'otp_required',
    otpRequested: true,
    needsManualAction: true,
    manualActionMessage: 'OTP filled. Please submit it manually and verify login.',
  });

  return { success: true };
}
function assertProfileId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Invalid profile ID');
  }
}

async function askContentScript<T>(
  tabId: number,
  message: { type: string }
): Promise<T> {
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (!response?.success) {
    throw new Error(response?.error ?? 'Could not read the IVAC page');
  }
  return response.data as T;
}

/**
 * Payment status পড়ো (read-only, পেজ reload/navigate করে না)
 */
async function handleCheckPayment(
  tabId: number,
  profileId: string
): Promise<PaymentCheckResult> {
  assertProfileId(profileId);

  const profile = await getProfile(profileId);
  if (!profile) throw new Error('Profile not found');

  const result = await askContentScript<PaymentCheckResult>(tabId, {
    type: 'CHECK_PAYMENT_STATUS',
  });

  const step = paymentStepFromResult(result);

  if (step) {
    await updateBookingState(profileId, {
      tabId,
      currentStep: step,
      paymentInfo: buildPaymentInfo(result),
      // undefined দিয়ে আগের মান মুছে ফেলো না
      ...(result.confirmationNumber && { confirmationNumber: result.confirmationNumber }),
      ...(result.invoiceUrl && { invoiceUrl: result.invoiceUrl }),
      needsManualAction: step !== 'payment_success',
      manualActionMessage: result.message,
    });
  }

  return result;
}

/**
 * Invoice ডাউনলোড করো। পেজ না ছেড়ে chrome.downloads দিয়ে।
 */
async function handleSaveInvoice(
  tabId: number,
  profileId: string
): Promise<{ success: boolean }> {
  assertProfileId(profileId);

  const profile = await getProfile(profileId);
  if (!profile) throw new Error('Profile not found');

  const result = await askContentScript<PaymentCheckResult>(tabId, {
    type: 'CHECK_PAYMENT_STATUS',
  });

  if (!result.isPaymentPage) {
    throw new Error('Open the payment or confirmation page first.');
  }
  if (!result.hasInvoice || !result.invoiceUrl) {
    throw new Error('No invoice link found on this page.');
  }
  if (!isTrustedInvoiceUrl(result.invoiceUrl)) {
    throw new Error('Invoice link is not a trusted https IVAC address.');
  }

  const downloadId = await chrome.downloads.download({
    url: result.invoiceUrl,
    filename: invoiceFilename(result.invoiceUrl),
    conflictAction: 'uniquify',
    saveAs: false,
  });

  if (downloadId === undefined) {
    throw new Error('Download could not be started.');
  }

  // এখানে ডাউনলোড শুরু হয়েছে, শেষ হয়েছে কিনা এখনো জানা নেই
  await updateBookingState(profileId, {
    tabId,
    currentStep: 'invoice_saved',
    invoiceUrl: result.invoiceUrl,
    needsManualAction: false,
    manualActionMessage: 'Invoice download started. Check your Downloads folder.',
  });

  return { success: true };
}
/**
 * Create a new booking window for a profile
 */
async function createBookingWindow(profileId: string): Promise<{ windowId: number }> {
  const profile = await getProfile(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  // Check concurrent window limit
  const allStates = await getAllBookingStates();
  const activeCount = Object.values(allStates).filter(
    (s) => s.currentStep !== 'locked' && s.currentStep !== 'paused'
  ).length;

  const settings = await getSettings();
  if (activeCount >= settings.maxConcurrentWindows) {
    throw new Error(`Maximum ${settings.maxConcurrentWindows} concurrent bookings allowed`);
  }

  // Create new window
  const window = await chrome.windows.create({
    url: 'https://appointment.ivacbd.com/',
    type: 'normal',
    focused: true,
  });

  if (!window || !window.id) {
    throw new Error('Failed to create window');
  }

  const windowId = window.id;
  const tabId = window.tabs?.[0]?.id;

  // Initialize booking state
  await updateBookingState(profileId, {
    currentStep: 'profile_selected',
    windowId,
    tabId,
    profileId,
    loginAttempts: 0,
    otpRequested: false,
    documentsUploaded: [],
    errors: [],
    isPaused: false,
    needsManualAction: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  });

  return { windowId };
}

/**
 * Pause a booking
 */
async function pauseBooking(profileId: string): Promise<{ success: boolean }> {
  await updateBookingState(profileId, {
    isPaused: true,
    currentStep: 'paused',
  });

  return { success: true };
}

/**
 * Resume a booking
 */
async function resumeBooking(profileId: string): Promise<{ success: boolean }> {
  const state = await getBookingState(profileId);
  if (!state) {
    throw new Error('No booking state found');
  }

  await updateBookingState(profileId, {
    isPaused: false,
    // Restore to appropriate step based on progress
    currentStep: state.otpRequested ? 'otp_required' : 'login_ready',
  });

  return { success: true };
}

/**
 * Handle tab updates to detect booking flow
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('ivacbd.com')) {
    // Notify content script that page is ready
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PAGE_READY' });
    } catch (error) {
      // Content script not ready yet, ignore
    }
  }
});

console.log('IVAC Assistant background service worker loaded');
