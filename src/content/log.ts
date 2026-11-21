/** Sends one line to the activity log (kept by the background script). Never throws. */
export function logEvent(
  level: 'info' | 'warn' | 'error',
  step: string,
  msg: string,
  data?: Record<string, string | number | boolean>
): void {
  try {
    void chrome.runtime
      .sendMessage({ type: 'LOG_EVENT', payload: { level, step, msg, data } })
      .catch(() => undefined);
  } catch {
    // the extension was reloaded while this page stayed open
  }
}