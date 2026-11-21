// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_KEY, autoSubmitIfRunning } from '../src/content/autoClick';

const store: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
    },
  },
});

function mountButton(disabled: boolean) {
  document.body.innerHTML = '<form><button type="submit" id="go">Go</button></form>';
  const button = document.getElementById('go') as HTMLButtonElement;
  button.disabled = disabled;
  let clicks = 0;
  button.addEventListener('click', (e) => {
    e.preventDefault();
    clicks++;
  });
  return { button, clicks: () => clicks };
}

describe('autoSubmitIfRunning (Start / Pause)', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while paused', async () => {
    const { button, clicks } = mountButton(false);
    const status = await autoSubmitIfRunning('t-paused', () => button);
    expect(status).toBe('paused');
    expect(clicks()).toBe(0);
  });

  it('clicks once when running and the button is enabled', async () => {
    store[AUTOMATION_KEY] = true;
    const { button, clicks } = mountButton(false);
    const status = await autoSubmitIfRunning('t-click', () => button);
    expect(status).toBe('clicked');
    expect(clicks()).toBe(1);
  });

  it('waits for a disabled button to become enabled, then clicks once', async () => {
    store[AUTOMATION_KEY] = true;
    const { button, clicks } = mountButton(true);
    const pending = autoSubmitIfRunning('t-wait', () => button);

    await vi.advanceTimersByTimeAsync(1000);
    expect(clicks()).toBe(0);

    button.disabled = false;
    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toBe('clicked');
    expect(clicks()).toBe(1);
  });

  it('gives up, pauses itself and does not click if the button never enables', async () => {
    store[AUTOMATION_KEY] = true;
    const { button, clicks } = mountButton(true);
    const pending = autoSubmitIfRunning('t-timeout', () => button, { timeoutMs: 3000 });

    await vi.advanceTimersByTimeAsync(4000);

    expect(await pending).toBe('timeout');
    expect(clicks()).toBe(0);
    expect(store[AUTOMATION_KEY]).toBe(false);
  });

  it('pauses itself when the button cannot be found', async () => {
    store[AUTOMATION_KEY] = true;
    const status = await autoSubmitIfRunning('t-nobutton', () => null);
    expect(status).toBe('no-button');
    expect(store[AUTOMATION_KEY]).toBe(false);
  });

  it('never clicks twice for the same step within a minute', async () => {
    store[AUTOMATION_KEY] = true;
    const { button, clicks } = mountButton(false);

    expect(await autoSubmitIfRunning('t-cooldown', () => button, { now: () => 1_000 })).toBe('clicked');
    expect(await autoSubmitIfRunning('t-cooldown', () => button, { now: () => 30_000 })).toBe('cooldown');
    expect(clicks()).toBe(1);

    expect(await autoSubmitIfRunning('t-cooldown', () => button, { now: () => 70_000 })).toBe('clicked');
    expect(clicks()).toBe(2);
  });
});

describe('autoSubmitIfRunning options for navigation steps', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for a button that is rendered a moment later', async () => {
    store[AUTOMATION_KEY] = true;
    document.body.innerHTML = '';
    const pending = autoSubmitIfRunning(
      't-late',
      () => document.getElementById('late'),
      { waitForButtonMs: 5000 }
    );

    await vi.advanceTimersByTimeAsync(1500);
    document.body.innerHTML = '<button id="late">Next Step</button>';
    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toBe('clicked');
  });

  it('does not pause the Start switch when pauseOnMissing is false', async () => {
    store[AUTOMATION_KEY] = true;
    const pending = autoSubmitIfRunning('t-missing-quiet', () => null, {
      waitForButtonMs: 1000,
      pauseOnMissing: false,
    });
    await vi.advanceTimersByTimeAsync(1500);

    expect(await pending).toBe('no-button');
    expect(store[AUTOMATION_KEY]).toBe(true);
  });

  it('respects a longer cooldown', async () => {
    store[AUTOMATION_KEY] = true;
    document.body.innerHTML = '<button id="b">Go</button>';
    const find = () => document.getElementById('b');
    const opts = { cooldownMs: 600_000 };

    expect(await autoSubmitIfRunning('t-long-cd', find, { ...opts, now: () => 0 })).toBe('clicked');
    expect(await autoSubmitIfRunning('t-long-cd', find, { ...opts, now: () => 300_000 })).toBe('cooldown');
    expect(await autoSubmitIfRunning('t-long-cd', find, { ...opts, now: () => 700_000 })).toBe('clicked');
  });
});