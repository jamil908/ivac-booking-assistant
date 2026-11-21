/**
 * Content script for IVAC website interaction
 * Phase 1: Basic structure and login detection
 */
import { fillOtp, findSubmitButton, setNativeValue } from './otp';
import { autoSubmitIfRunning, isAutomationRunning, pauseAutomation } from './autoClick';
import type { AutoSubmitStatus } from './autoClick';
import { logEvent } from './log';
import { findButtonByText, findNavStep, isMissionPage, isTimeSlotPage, isUploadPage, NavStep } from './navigation';
import { centerMatchesMission, readMissionAndCenter } from './mission';
import { runDateCycle } from './timeslot';
import { findUploadInput, getUploadState, injectFile, readApplicantCount, uploadFilesSerially, waitForUploadReady } from './upload';
import { acceptConfirmPopup, closeInfoPopups } from './popups';
import type { UploadFile } from './upload';
console.log('IVAC Assistant content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);

  switch (message.type) {

    case 'PAGE_READY':
      detectPageType();
      sendResponse({ success: true });
      break;

    case 'FILL_LOGIN':
      fillLoginForm(message.payload);
      sendResponse({ success: true });
      break;

    case 'SUBMIT_OTP': {
      sendResponse(handleOTPSubmission({ otp: message.payload?.otp }));
      break;
    }

    case 'CHECK_PAYMENT_STATUS':
      checkPaymentStatus()
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    case 'SAVE_INVOICE':
      saveInvoice()
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    case 'GET_UPLOAD_STATE':
      sendResponse({
        success: true,
        data: {
          ...getUploadState(document),
          onUploadPage: isUploadPage(window.location.hostname, window.location.pathname),
        },
      });
      break;

    case 'INJECT_FILE':
      handleInjectFile(message.payload)
        .then((result) =>
          sendResponse(result.ok ? { success: true, data: result } : { success: false, error: result.reason })
        )
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

/**
 * Detect what page we're on and notify background
 */
function detectPageType() {
  const url = window.location.href;
  const pathname = window.location.pathname;

  console.log('Detecting page type:', url);

  // Login page detection
  if (pathname.includes('/login') || document.querySelector('input[type="password"]')) {
    console.log('Login page detected');
    highlightExtensionReady();
  }

  // Profile/form page
  if (pathname.includes('/application') || pathname.includes('/form')) {
    console.log('Application form detected');
  }

  // Booking page
  if (pathname.includes('/appointment') || pathname.includes('/booking')) {
    console.log('Booking page detected');
  }

  // Payment page
  if (pathname.includes('/payment') || pathname.includes('/checkout')) {
    console.log('Payment page detected');
  }
}

/**
 * Fill login form with credentials
 */
function fillLoginForm(credentials: { username?: string; password?: string }) {
  console.log('Attempting to fill login form');

if (
  !credentials ||
  typeof credentials.username !== 'string' ||
  typeof credentials.password !== 'string' ||
  !credentials.username.trim() ||
  !credentials.password.trim()
) {
  console.error('Invalid or missing credentials');
  showNotification(
    'Missing or invalid credentials. Please update your profile.',
    'error'
  );
  return;
}
  // Find username/email field
 // Find phone number field
const usernameField = document.querySelector<HTMLInputElement>(
  'input[name="phone"]'
);

// Find password field
const passwordField = document.querySelector<HTMLInputElement>(
  'input[type="password"][name="password"]'
);

  if (!usernameField || !passwordField) {
    console.error('Login fields not found');
    showNotification('Could not find login fields on this page', 'error');
    return;
  }

  // Fill fields with a slight delay to mimic human behavior
  setTimeout(() => {
    setNativeValue(usernameField, credentials.username!);
  }, 100);

  setTimeout(() => {
    setNativeValue(passwordField, credentials.password!);

    showNotification('Login credentials filled. Review and submit manually.', 'success');
        highlightLoginButton();
    void runAutoSubmit('login', findLoginButton);
  }, 300);
}

/**
 * Highlight the login button for user to click
 */

function findLoginButton(): HTMLElement | null {
  // Find a standard submit button first.
  const submitButton = document.querySelector<
    HTMLButtonElement | HTMLInputElement
  >('button[type="submit"], input[type="submit"]');

  // Fallback: find a button labelled Login or Sign in.
  const textButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button')
  ).find((button) =>
    /\b(log\s*in|sign\s*in)\b/i.test(button.textContent?.trim() ?? '')
  );

  return submitButton ?? textButton ?? null;
}

function highlightLoginButton() {
  const loginButton = findLoginButton();

  if (loginButton) {
    loginButton.style.outline = '3px solid #10b981';
    loginButton.style.outlineOffset = '2px';
    loginButton.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}

async function runAutoSubmit(
  key: string,
  findButton: () => HTMLElement | null,
  options: { waitForButtonMs?: number; pauseOnMissing?: boolean; cooldownMs?: number; timeoutMs?: number } = {}
): Promise<AutoSubmitStatus> {
  const status = await autoSubmitIfRunning(key, findButton, options);

  if (status === 'clicked') {
    showNotification('Auto mode: button clicked once.', 'info');
    logEvent('info', key, 'Button clicked once.');
  } else if (status === 'timeout') {
    showNotification(
      'The button is still disabled (security check pending or invalid input). Auto mode paused. Please click it yourself.',
      'error'
    );
    logEvent('error', key, 'The button stayed disabled (security check, a waiting time on the page, or invalid input). Auto mode paused.');
  } else if (status === 'no-button') {
    if (options.pauseOnMissing !== false) {
      showNotification('Could not find the button. Auto mode paused.', 'error');
      logEvent('error', key, 'Button not found. Auto mode paused.');
    } else {
      logEvent('warn', key, 'Button not found on this page. Nothing was done.');
    }
  } else if (status === 'cooldown') {
    logEvent('info', key, 'Skipped: this step already ran a moment ago.');
  }
  return status;
}

const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** After login: Take Your Appointment -> Next Step -> upload page (upload flow below). */
let lastRouteKey = '';
let routeTimer: number | undefined;

/** Closes the information popups, clicks the step's button once and checks that the page really moved on */
async function runNavStep(step: NavStep) {
  if (!(await isAutomationRunning())) return;
  const key = `nav:${step.id}`;

  const closed = await closeInfoPopups(document, {
    onClosed: (n) => logEvent('info', key, `Closed information popup ${n}.`),
  });
  if (closed > 0) showNotification(`Closed ${closed} information popup(s).`, 'info');

  const startPath = window.location.pathname;
  const status = await runAutoSubmit(key, () => findButtonByText(document, step.buttonText), {
    waitForButtonMs: 10_000,
    pauseOnMissing: false,
    cooldownMs: 600_000,
    timeoutMs: 60_000, // some notice pages keep the button disabled for a while
  });
  if (status !== 'clicked') return;

  for (let i = 0; i < 32; i++) {
    if (window.location.pathname !== startPath) return;
    await sleepMs(250);
  }

  const button = findButtonByText(document, step.buttonText);
  if (button) {
    button.style.outline = '3px solid #10b981';
    button.style.outlineOffset = '2px';
  }
  logEvent('warn', key, 'The button was clicked but the page did not change. The site may ignore script clicks. Please click it yourself.');
  showNotification('The page did not move on after the click. Please click the highlighted button yourself.', 'error');
}

let uploadFlowStarted = false;

/**
 * Upload page, only when Start is on and verified files are saved:
 * upload the files one by one (primary first), then Confirm All Information, then Save & Continue.
 * Fails closed: any surprise pauses auto mode and leaves the rest to you.
 */
async function runUploadPageFlow() {
  if (uploadFlowStarted) return;
  if (!(await isAutomationRunning())) return;
  uploadFlowStarted = true;
  logEvent('info', 'upload', 'Upload page reached.');

  const response = await chrome.runtime.sendMessage({ type: 'GET_UPLOAD_FILES' });
  if (!response?.success) {
    const reason = response?.error ?? 'no answer from the extension';
    showNotification(`Could not load your saved web files: ${reason}`, 'error');
    logEvent('error', 'upload', `Could not load the saved files: ${reason}`);
    return;
  }

  const files = response.data as UploadFile[];
  logEvent('info', 'upload', `${files.length} verified file(s) ready.`, { files: files.length });
  if (files.length === 0) {
    showNotification(
      'No verified web files saved. Add them in Options > Files and tick "Verified", or upload manually.',
      'info'
    );
    logEvent('warn', 'upload', 'No verified files are saved for the active profile.');
    return;
  }

  // a confirmation popup may come first; the upload area only appears after it is confirmed
  await acceptConfirmPopup(document, {
    isReady: () => readApplicantCount(document) !== null && findUploadInput(document) !== null,
    onAccepted: () => {
      showNotification('Confirmation popup accepted.', 'info');
      logEvent('info', 'upload', 'Confirmation popup accepted.');
    },
  });

  if (!(await waitForUploadReady(document))) {
    await pauseAutomation();
    showNotification(
      'The upload area did not appear. If a popup is still open, please confirm it yourself. Auto mode paused.',
      'error'
    );
    logEvent('error', 'upload', 'The upload area did not appear within 15 seconds. Auto mode paused.');
    return;
  }

  showNotification(`Uploading ${files.length} web file(s), one by one...`, 'info');

  const result = await uploadFilesSerially(document, files, {
    onProgress: (done, total) => {
      showNotification(`Uploaded ${done} of ${total}.`, 'success');
      logEvent('info', 'upload', `Uploaded ${done} of ${total}.`);
    },
    onEvent: (message) => logEvent('info', 'upload', message),
  });

  if (!result.ok) {
    await pauseAutomation();
    showNotification(`Upload stopped: ${result.reason} Auto mode paused.`, 'error');
    logEvent('error', 'upload', `Upload stopped: ${result.reason}`, { uploaded: result.uploaded, total: result.total });
    return;
  }

  // The applicant counter now equals the number of verified files, so the declaration matches what you saved
  await runAutoSubmit(
    'upload-confirm',
    () => findButtonByText(document, /confirm\s+all\s+information\s+is\s+correct/i),
    { waitForButtonMs: 15_000, cooldownMs: 600_000 }
  );
  await runAutoSubmit(
    'upload-save',
    () => findButtonByText(document, /save\s*&\s*continue/i),
    { waitForButtonMs: 15_000, cooldownMs: 600_000 }
  );
}

/** The upload icon in the popup: put ONE saved file into the page (works with auto mode off) */
async function handleInjectFile(file: UploadFile & { index: number }) {
  if (!isUploadPage(window.location.hostname, window.location.pathname)) {
    return { ok: false as const, reason: 'Open the file upload page first.' };
  }

  logEvent('info', 'manual-upload', `Manual upload of file ${file.index + 1} (${file.role}).`);
  const result = await injectFile(document, file, {
    onEvent: (message) => logEvent('info', 'manual-upload', message),
  });

  if (result.ok) {
    showNotification(`File ${file.index + 1} uploaded.`, 'success');
    logEvent('info', 'manual-upload', `File ${file.index + 1} uploaded.`);
  } else {
    showNotification(`Manual upload stopped: ${result.reason}`, 'error');
    logEvent('error', 'manual-upload', result.reason);
  }
  return result;
}

let missionStepStarted = false;

/** Mission page: confirm only when the displayed center belongs to the displayed mission (cannot be changed later) */
async function runMissionStep() {
  if (missionStepStarted) return;
  if (!(await isAutomationRunning())) return;
  missionStepStarted = true;

  let info = readMissionAndCenter(document);
  for (let i = 0; i < 40 && !centerMatchesMission(info.mission, info.center); i++) {
    await sleepMs(250);
    info = readMissionAndCenter(document);
  }

  if (!centerMatchesMission(info.mission, info.center)) {
    await pauseAutomation();
    showNotification(
      `Mission "${info.mission ?? '?'}" and center "${info.center ?? '?'}" do not match. This cannot be changed after submission, so please check and confirm yourself. Auto mode paused.`,
      'error'
    );
    logEvent('error', 'mission', `Mission "${info.mission ?? '?'}" and center "${info.center ?? '?'}" do not match. Auto mode paused.`);
    return;
  }

  showNotification(`Mission ${info.mission}, center ${info.center}. Confirming...`, 'info');
  logEvent('info', 'mission', `Mission ${info.mission}, center ${info.center}. Confirming.`);
  await runAutoSubmit(
    'mission-confirm',
    () => findButtonByText(document, /confirm\s+mission/i),
    { waitForButtonMs: 10_000, cooldownMs: 600_000 }
  );
}

let timeSlotStepStarted = false;

/** Date page: one careful pass over the open dates, 15 seconds apart, stopping at the payment page */
async function runTimeSlotStep() {
  if (timeSlotStepStarted) return;
  if (!(await isAutomationRunning())) return;
  timeSlotStepStarted = true;

  showNotification('Checking the open dates one by one (15 seconds apart)...', 'info');
  logEvent('info', 'dates', 'Starting one pass over the open dates.');

  const result = await runDateCycle({
    doc: document,
    isRunning: isAutomationRunning,
    isOnPage: () => isTimeSlotPage(window.location.hostname, window.location.pathname),
    onStatus: (message) => logEvent('info', 'dates', message),
  });

  if (result.status === 'left-page') {
    showNotification(
      'The date page was left (probably the payment page). Please check it and pay yourself.',
      'success'
    );
    logEvent('info', 'dates', `The date page was left after date ${result.day} (probably the payment page).`);
  } else if (result.status === 'exhausted') {
    const text =
      result.tried.length === 0
        ? 'No open date found on this page.'
        : `No date worked this time (tried ${result.tried.join(', ')}). Reload the page to try one more pass.`;
    showNotification(text, 'info');
    logEvent('warn', 'dates', text);
  } else {
    if (result.reason !== 'Auto mode was paused.') await pauseAutomation();
    showNotification(`Stopped: ${result.reason}`, 'error');
    logEvent('error', 'dates', `Stopped: ${result.reason}`);
  }
}

function handleRouteChange() {
  const { hostname, pathname } = window.location;
  const routeKey = `${hostname}${pathname}`;
  if (routeKey === lastRouteKey) return;
  lastRouteKey = routeKey;
  logEvent('info', 'route', `Moved to ${pathname}`);

  if (isUploadPage(hostname, pathname)) {
    void runUploadPageFlow();
    return;
  }

  if (isMissionPage(hostname, pathname)) {
    void runMissionStep();
    return;
  }

  if (isTimeSlotPage(hostname, pathname)) {
    void runTimeSlotStep();
    return;
  }

  const step = findNavStep(hostname, pathname);
  if (step) void runNavStep(step);
}

// The site is a single-page app: watch for route changes instead of page loads
const routeObserver = new MutationObserver(() => {
  window.clearTimeout(routeTimer);
  routeTimer = window.setTimeout(handleRouteChange, 300);
});
routeObserver.observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', handleRouteChange);
handleRouteChange();



/**
 * Show visual indicator that extension is ready
 */
function highlightExtensionReady() {
  const indicator = document.createElement('div');
  indicator.id = 'ivac-assistant-indicator';
  indicator.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      IVAC Assistant Ready
    </div>
  `;
  
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    indicator.remove();
  }, 3000);
}

/**
 * Show notification banner
 */
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
  };

  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 300px;
    ">
      ${message}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Detect OTP input fields
// let otpNotificationShown = false;

// function detectOTPField() {
//   const otpField = document.querySelector(
//     'input[type="text"][maxlength="6"], input[type="number"][maxlength="6"], input[name*="otp"], input[id*="otp"]'
//   );

//   if (otpField && !otpNotificationShown) {
//     otpNotificationShown = true;

//     console.log('OTP field detected');

//     showNotification(
//       'Please enter the OTP you received',
//       'info'
//     );
//   }
// }

// const observer = new MutationObserver(() => {
//   detectOTPField();
// });

// observer.observe(document.body, {
//   childList: true,
//   subtree: true
// });

// Run detection on load
detectPageType();

// Watch for dynamic content changes


// Clean up on page unload
// window.addEventListener('beforeunload', () => {
//   observer.disconnect();
// });

/**
 * Handle OTP submission (user-controlled)
 * Only fills the OTP field, user must click submit
 */
function handleOTPSubmission(
  payload: { otp: unknown }
): { success: boolean; error?: string } {
  const result = fillOtp(document, payload.otp);

  if (!result.success) {
    showNotification(result.error, 'error');
    return { success: false, error: result.error };
  }

  // Highlight the button that belongs to the OTP field (never click it)
  const submitButton = findSubmitButton(result.anchor);

  if (submitButton) {
    submitButton.style.outline = '3px solid #10b981';
    submitButton.style.outlineOffset = '2px';
    submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showNotification(
    'OTP filled. Please review and click Submit manually.',
    'success'
  );
  void runAutoSubmit('otp', () => findSubmitButton(result.anchor));

  return { success: true };
}

/**
 * Check payment status on current page (SAFE - READ ONLY)
 * NEVER reloads, navigates, or resubmits payment
 */
async function checkPaymentStatus(): Promise<{
  isPaymentPage: boolean;
  status: 'success' | 'pending' | 'failed' | 'unknown';
  hasInvoice: boolean;
  invoiceUrl?: string;
  confirmationNumber?: string;
  amount?: string;
  message: string;
}> {
  const url = window.location.href;
  const pathname = window.location.pathname;
  const bodyText = document.body.textContent?.toLowerCase() || '';

  // Conservative payment page detection
  const isPaymentPage = 
    url.includes('/payment') ||
    url.includes('/checkout') ||
    url.includes('/invoice') ||
    url.includes('/confirm') ||
    pathname.includes('/payment') ||
    pathname.includes('/invoice');

  if (!isPaymentPage) {
    return {
      isPaymentPage: false,
      status: 'unknown',
      hasInvoice: false,
      message: 'Not on a payment or confirmation page',
    };
  }

  // Check for success indicators (conservative)
  const successIndicators = [
    'payment successful',
    'transaction successful',
    'booking confirmed',
    'appointment confirmed',
    'payment complete'
  ];

  const hasSuccessIndicator = successIndicators.some(indicator => 
    bodyText.includes(indicator)
  );

  // Check for failure indicators
  const failureIndicators = [
    'payment failed',
    'transaction failed',
    'payment declined',
    'insufficient funds'
  ];

  const hasFailureIndicator = failureIndicators.some(indicator =>
    bodyText.includes(indicator)
  );

  // Look for invoice/confirmation elements
const invoiceLink =
  document.querySelector<HTMLAnchorElement>('a[href*="invoice" i], a[href*="receipt" i]') ??
  document.querySelector<HTMLAnchorElement>('a[href*="download" i]');
  const confirmationNumber = extractConfirmationNumber();
  const amount = extractPaymentAmount();

  let status: 'success' | 'pending' | 'failed' | 'unknown' = 'unknown';
  let message = '';

  if (hasSuccessIndicator && invoiceLink) {
    status = 'success';
    message = 'Payment appears successful. Invoice available.';
  } else if (hasSuccessIndicator) {
    status = 'success';
    message = 'Payment appears successful. Invoice may not be available yet.';
  } else if (hasFailureIndicator) {
    status = 'failed';
    message = 'Payment appears to have failed.';
  } else if (bodyText.includes('processing') || bodyText.includes('pending')) {
    status = 'pending';
    message = 'Payment is pending. Please wait for confirmation.';
  } else {
    status = 'unknown';
    message = 'Payment status is unclear. Please verify manually through official channels.';
  }

  return {
    isPaymentPage: true,
    status,
    hasInvoice: !!invoiceLink,
    invoiceUrl: invoiceLink?.href,
    confirmationNumber,
    amount,
    message,
  };
}

/**
 * Extract confirmation/booking number from page
 */
function extractConfirmationNumber(): string | undefined {
  const bodyText = document.body.textContent || '';
  
  // Look for confirmation number patterns
  const patterns = [
    /confirmation\s*(?:number|id|no\.?|#)\s*:?\s*([A-Z0-9]{6,20})/i,
    /booking\s*(?:number|id|reference|no\.?|#)\s*:?\s*([A-Z0-9]{6,20})/i,
    /transaction\s*(?:id|no\.?|#)\s*:?\s*([A-Z0-9]{6,20})/i,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract payment amount from page
 */
function extractPaymentAmount(): string | undefined {
  const bodyText = document.body.textContent || '';
  
  // Look for amount patterns (BDT or other currencies)
  const patterns = [
    /(?:amount|total|paid)\s*:?\s*(BDT|৳|USD|\$|EUR|€)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:BDT|৳|USD|\$|EUR|€)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

/**
 * Save invoice/receipt (SAFE - DOWNLOAD ONLY)
 * NEVER reloads page or triggers new payment
 */
async function saveInvoice(): Promise<{ success: boolean; message: string }> {
  const paymentStatus = await checkPaymentStatus();

  if (!paymentStatus.isPaymentPage) {
    throw new Error('Not on a payment or confirmation page');
  }

  if (!paymentStatus.hasInvoice) {
    throw new Error('No invoice download link found on this page');
  }

  if (!paymentStatus.invoiceUrl) {
    throw new Error('Invoice URL is not available');
  }

  // Validate invoice URL (security check)
  const invoiceUrl = paymentStatus.invoiceUrl;
  const allowedDomains = ['ivacbd.com', 'appointment.ivacbd.com', 'payment.ivacbd.com'];
  
  try {
    const url = new URL(invoiceUrl);
    const isAllowed = allowedDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      throw new Error('Invoice URL is from an untrusted domain');
    }

    // Validate file extension
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const hasValidExtension = validExtensions.some(ext => 
      invoiceUrl.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension && !invoiceUrl.includes('download') && !invoiceUrl.includes('invoice')) {
      console.warn('Invoice URL may not be a document file');
    }

  } catch (error) {
    throw new Error('Invalid invoice URL format');
  }

  // Create download link (safe method)
  const downloadLink = document.createElement('a');
  downloadLink.href = invoiceUrl;
  downloadLink.download = `IVAC_Invoice_${Date.now()}.pdf`;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  
  // Trigger download
  downloadLink.click();
  
  // Clean up
  document.body.removeChild(downloadLink);

  showNotification('Invoice download started. Check your Downloads folder.', 'success');

  return {
    success: true,
    message: 'Invoice download initiated',
  };
}
