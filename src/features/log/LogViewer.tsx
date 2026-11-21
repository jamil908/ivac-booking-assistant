import { useEffect, useMemo, useState } from 'react';
import type { LogEntry } from '../../types';

// keep identical to LOG_KEY in src/storage/log.ts
const LOG_KEY = 'ivac_log';

type Reply = { success: boolean; data?: unknown; error?: string };

function send(message: { type: string; payload?: unknown }): Promise<Reply> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
};

function time(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function toText(entries: LogEntry[]): string {
  return entries
    .map((e) => {
      const extra = e.data ? ' ' + JSON.stringify(e.data) : '';
      return `${new Date(e.t).toLocaleString()} [${e.level.toUpperCase()}] ${e.step}: ${e.msg}${extra}`;
    })
    .join('\n');
}

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const res = await send({ type: 'GET_LOG' });
    setEntries(res.success ? (res.data as LogEntry[]) : []);
  };

  useEffect(() => {
    void load();
    // new lines appear by themselves while this page is open
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && LOG_KEY in changes) void load();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // newest first
  const shown = useMemo(
    () => [...entries].reverse().filter((e) => !onlyProblems || e.level !== 'info'),
    [entries, onlyProblems]
  );

  const problems = entries.filter((e) => e.level === 'error').length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText([...shown].reverse()));
      setNote('Copied. Paste it in the chat.');
    } catch {
      setNote('Could not copy.');
    }
  };

  const clear = async () => {
    if (!window.confirm('Clear the whole log?')) return;
    await send({ type: 'CLEAR_LOG' });
    setNote('Log cleared.');
    await load();
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        What the extension did on the IVAC pages and where it stopped. Passwords, OTPs, phone numbers and file
        contents are never written here.
      </p>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={() => void load()} className="px-3 py-1.5 border rounded-md text-sm">Refresh</button>
        <button onClick={() => void copy()} className="px-3 py-1.5 border rounded-md text-sm">Copy</button>
        <button onClick={() => void clear()} className="px-3 py-1.5 border rounded-md text-sm text-red-700">Clear</button>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          Only warnings and errors
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {entries.length} lines{problems > 0 && <b className="text-red-700"> · {problems} error(s)</b>}
        </span>
      </div>

      {note && <p className="text-sm text-green-700 mb-2">{note}</p>}

      <div className="border rounded-md divide-y max-h-[60vh] overflow-y-auto">
        {shown.length === 0 && <p className="p-4 text-sm text-gray-500">Nothing logged yet.</p>}

        {shown.map((e, i) => (
          <div key={`${e.t}-${i}`} className="flex gap-3 p-2 text-sm items-start">
            <span className="text-gray-500 tabular-nums shrink-0">{time(e.t)}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${LEVEL_STYLE[e.level]}`}>
              {e.level.toUpperCase()}
            </span>
            <span className="font-mono text-xs text-gray-600 shrink-0 pt-0.5">{e.step}</span>
            <span className="flex-1 break-words">
              {e.msg}
              {e.data && (
                <span className="text-gray-500 text-xs"> {Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(', ')}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}