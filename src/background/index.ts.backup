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
} from '../storage';
import {
  isLocked,
  unlockExtension,
  lockExtension,
  getLockStatus,
  checkInactivityTimeout,
  updateLastActivity,
} from '../security/lock';

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('IVAC Assistant installed');
  await initializeStorage();
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
  handleMessage(message, sender)
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  
  // Return true to indicate async response
  return true;
});

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
  console.log('Background received message:', message.type);

  // Update activity timestamp for non-sensitive operations
  if (message.type !== 'CHECK_LOCK_STATUS') {
    await updateLastActivity();
  }

  // Check if locked for sensitive operations
  const locked = await isLocked();
  const sensitiveOps = [
    'GET_PROFILES',
    'SAVE_PROFILE',
    'DELETE_PROFILE',
    'GET_BOOKING_STATE',
    'AUTOFILL_LOGIN',
    'SUBMIT_OTP',
  ];

  if (locked && sensitiveOps.includes(message.type)) {
    throw new Error('Extension is locked. Please unlock to continue.');
  }

  switch (message.type) {
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
      return { success: true };

    case 'SET_ACTIVE_PROFILE':
      await setActiveProfile(message.payload as string);
      return { success: true };

    case 'GET_BOOKING_STATE':
      return await getBookingState(message.payload as string);

    case 'GET_ALL_BOOKING_STATES':
      return await getAllBookingStates();

    case 'UPDATE_BOOKING_STATE':
      const { profileId, state } = message.payload as { profileId: string; state: Parameters<typeof updateBookingState>[1] };
      return await updateBookingState(profileId, state);

    case 'RESET_BOOKING':
      await resetBookingState(message.payload as string);
      return { success: true };

    case 'GET_SETTINGS':
      return await getSettings();

    case 'UPDATE_SETTINGS':
      return await updateSettings(message.payload as Parameters<typeof updateSettings>[0]);

    case 'AUTOFILL_LOGIN':
      return await handleAutofillLogin(sender.tab?.id, message.payload as string);

    case 'REQUEST_OTP':
      return await handleOTPRequest(sender.tab?.id, message.payload as string);

    case 'SUBMIT_OTP':
      return await handleOTPSubmit(sender.tab?.id, message.payload as { profileId: string; otp: string });

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

/**
 * Handle OTP request
 */
async function handleOTPRequest(tabId: number | undefined, profileId: string): Promise<{ success: boolean }> {
  if (!tabId) {
    throw new Error('No tab ID provided');
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

  // Update booking state
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry
  await updateBookingState(profileId, {
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

  const { profileId, otp } = payload;

  // Send OTP to content script
  await chrome.tabs.sendMessage(tabId, {
    type: 'SUBMIT_OTP',
    payload: { otp },
  });

  // Update booking state
  await updateBookingState(profileId, {
    currentStep: 'authenticated',
    otpRequested: false,
    needsManualAction: false,
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
