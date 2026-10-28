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

  if (!credentials.username || !credentials.password) {
    console.error('Missing credentials');
    showNotification('Missing credentials. Please update your profile.', 'error');
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
