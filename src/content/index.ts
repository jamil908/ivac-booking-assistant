/**
 * Content script for IVAC website interaction
 * Phase 1: Basic structure and login detection
 */

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
  const otp = message.payload?.otp;

  if (
    typeof otp !== 'string' ||
    !/^\d{4,6}$/.test(otp)
  ) {
    sendResponse({
      success: false,
      error: 'Invalid OTP. Please enter a valid 4–6 digit OTP.',
    });
    break;
  }

  handleOTPSubmission({ otp });
  sendResponse({ success: true });
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
  const usernameField = document.querySelector<HTMLInputElement>(
    'input[type="email"], input[type="text"][name*="email"], input[name*="username"], input[id*="email"], input[id*="username"]'
  );

  // Find password field
  const passwordField = document.querySelector<HTMLInputElement>(
    'input[type="password"]'
  );

  if (!usernameField || !passwordField) {
    console.error('Login fields not found');
    showNotification('Could not find login fields on this page', 'error');
    return;
  }

  // Fill fields with a slight delay to mimic human behavior
  setTimeout(() => {
    if (usernameField) {
      usernameField.value = credentials.username!;
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, 100);

  setTimeout(() => {
    if (passwordField) {
      passwordField.value = credentials.password!;
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    showNotification('Login credentials filled. Review and submit manually.', 'success');
    highlightLoginButton();
  }, 300);
}

/**
 * Highlight the login button for user to click
 */

function highlightLoginButton() {
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

  const loginButton = submitButton ?? textButton;

  if (loginButton) {
    loginButton.style.outline = '3px solid #10b981';
    loginButton.style.outlineOffset = '2px';
    loginButton.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}

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
function detectOTPField() {
  const otpFields = document.querySelectorAll<HTMLInputElement>(
    'input[type="text"][maxlength="6"], input[type="number"][maxlength="6"], input[name*="otp"], input[id*="otp"]'
  );

  if (otpFields.length > 0) {
    console.log('OTP field detected');
    // Notify user to enter OTP manually
    showNotification('Please enter the OTP you received', 'info');
  }
}

// Run detection on load
detectPageType();

// Watch for dynamic content changes
const observer = new MutationObserver(() => {
  detectOTPField();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  observer.disconnect();
});

/**
 * Handle OTP submission (user-controlled)
 * Only fills the OTP field, user must click submit
 */
function handleOTPSubmission(payload: { otp: string }) {
  console.log('Handling OTP submission');

  if (!payload?.otp) {
    showNotification('OTP value is missing', 'error');
    return;
  }

  // Find OTP input field using multiple selectors
  const otpField = document.querySelector<HTMLInputElement>(
    'input[name*="otp" i], input[id*="otp" i], input[placeholder*="otp" i], ' +
    'input[type="text"][maxlength="4"], input[type="text"][maxlength="6"], ' +
    'input[type="number"][maxlength="4"], input[type="number"][maxlength="6"]'
  );

  if (!otpField) {
    console.error('OTP field not found');
    showNotification('Could not find OTP input field on this page', 'error');
    return;
  }

  // Fill OTP field
  otpField.value = payload.otp;
  otpField.dispatchEvent(new Event('input', { bubbles: true }));
  otpField.dispatchEvent(new Event('change', { bubbles: true }));

  // Highlight the submit button
  const submitButton = document.querySelector<
  HTMLButtonElement | HTMLInputElement
>(
  'button[type="submit"], input[type="submit"]'
);

  if (submitButton) {
    submitButton.style.outline = '3px solid #10b981';
    submitButton.style.outlineOffset = '2px';
    submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showNotification('OTP filled. Please review and click Submit button.', 'success');
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
  const invoiceLink = document.querySelector<HTMLAnchorElement>(
  'a[href*="invoice"], a[href*="receipt"], a[href*="download"]'
);
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
