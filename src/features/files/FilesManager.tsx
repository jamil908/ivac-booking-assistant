import { useEffect, useRef, useState } from 'react';
import type { ApplicantProfile, StoredFileInfo } from '../../types';

// keep identical to the limits in src/storage/files.ts
const MAX_FILES = 4;
const MAX_BYTES = 500 * 1024;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

type Reply = { success: boolean; data?: unknown; error?: string };

function send(message: { type: string; payload?: unknown }): Promise<Reply> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function checkLocally(file: File): string | null {
  if (!/\.pdf$/i.test(file.name)) return 'Only PDF files are accepted.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_BYTES) return 'The file is larger than 500KB, so IVAC would reject it.';
  return null;
}

export function FilesManager({
  profiles,
  activeProfileId,
}: {
  profiles: ApplicantProfile[];
  activeProfileId: string | null;
}) {
  const [profileId, setProfileId] = useState<string>(activeProfileId ?? profiles[0]?.id ?? '');
  const [files, setFiles] = useState<StoredFileInfo[]>([]);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const load = async (id: string) => {
    const res = await send({ type: 'LIST_FILES', payload: id });
    if (res.success) {
      setFiles(res.data as StoredFileInfo[]);
    } else {
      setFiles([]);
      setMessage({ type: 'error', text: res.error ?? 'Could not load files.' });
    }
  };

  useEffect(() => {
    if (profileId) void load(profileId);
    else setFiles([]);
  }, [profileId]);

  const run = async (action: () => Promise<Reply>, okText: string) => {
    setBusy(true);
    setMessage(null);
    const res = await action();
    if (res.success) {
      setMessage({ type: 'ok', text: okText });
      await load(profileId);
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Something went wrong.' });
    }
    setBusy(false);
  };

  const handleAdd = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkLocally(file);
    if (problem) return setMessage({ type: 'error', text: problem });

    await run(async () => {
      const dataBase64 = await readAsBase64(file);
      return send({
        type: 'ADD_FILE',
        payload: { profileId, name: file.name, lastModified: file.lastModified, dataBase64 },
      });
    }, 'File saved. Tick "Verified" after you have checked it.');
  };

  const handleReplace = async (file: File | undefined) => {
    const fileId = replacingId;
    setReplacingId(null);
    if (!file || !fileId) return;
    const problem = checkLocally(file);
    if (problem) return setMessage({ type: 'error', text: problem });

    await run(async () => {
      const dataBase64 = await readAsBase64(file);
      return send({
        type: 'REPLACE_FILE',
        payload: { profileId, fileId, name: file.name, lastModified: file.lastModified, dataBase64 },
      });
    }, 'File replaced. Verify it again.');
  };

  if (profiles.length === 0) {
    return <p className="text-gray-600">Create a profile first, then add its web files here.</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Save the BGD web files (PDF, max 500KB) for this profile. The first file is the primary applicant,
        the others are secondary. Files are encrypted and stay on this computer. IVAC does not allow a file to be
        changed after it is selected, so only files you tick as <b>Verified</b> are uploaded automatically.
      </p>

      <label className="block text-sm font-medium mb-1">Profile</label>
      <select
        value={profileId}
        onChange={(e) => {
          setMessage(null);
          setProfileId(e.target.value);
        }}
        className="border rounded-md px-3 py-2 mb-4"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="space-y-2">
        {files.length === 0 && <p className="text-gray-500 text-sm">No files saved yet.</p>}

        {files.map((f, index) => {
          const old = f.lastModified !== undefined && Date.now() - f.lastModified > THIRTY_DAYS;
          return (
            <div key={f.id} className="border rounded-md p-3 flex items-center gap-3 flex-wrap">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${
                  f.role === 'primary' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {f.role === 'primary' ? 'Primary' : `Secondary ${index}`}
              </span>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-xs text-gray-500">
                  {(f.size / 1024).toFixed(0)} KB
                  {f.lastModified !== undefined && ` · file date ${new Date(f.lastModified).toLocaleDateString()}`}
                </div>
                {old && (
                  <div className="text-xs text-amber-700">
                    This file is more than 30 days old. IVAC may reject old web files.
                  </div>
                )}
              </div>

              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={f.verified}
                  disabled={busy}
                  onChange={(e) =>
                    run(
                      () => send({ type: 'UPDATE_FILE', payload: { profileId, fileId: f.id, verified: e.target.checked } }),
                      e.target.checked ? 'Marked as verified.' : 'Verification removed.'
                    )
                  }
                />
                Verified
              </label>

              <button disabled={busy || index === 0} className="px-2 py-1 border rounded disabled:opacity-40"
                onClick={() => run(() => send({ type: 'MOVE_FILE', payload: { profileId, fileId: f.id, direction: 'up' } }), 'Moved up. Verify the moved files again.')}>
                ↑
              </button>
              <button disabled={busy || index === files.length - 1} className="px-2 py-1 border rounded disabled:opacity-40"
                onClick={() => run(() => send({ type: 'MOVE_FILE', payload: { profileId, fileId: f.id, direction: 'down' } }), 'Moved down. Verify the moved files again.')}>
                ↓
              </button>
              <button disabled={busy} className="px-2 py-1 border rounded"
                onClick={() => {
                  const name = window.prompt('File name', f.name);
                  if (name && name.trim()) {
                    void run(() => send({ type: 'UPDATE_FILE', payload: { profileId, fileId: f.id, name } }), 'Renamed.');
                  }
                }}>
                Rename
              </button>
              <button disabled={busy} className="px-2 py-1 border rounded"
                onClick={() => {
                  setReplacingId(f.id);
                  replaceInput.current?.click();
                }}>
                Replace
              </button>
              <button disabled={busy} className="px-2 py-1 border rounded text-red-700"
                onClick={() => {
                  if (window.confirm(`Delete ${f.name}? Files after it move up and must be verified again.`)) {
                    void run(() => send({ type: 'DELETE_FILE', payload: { profileId, fileId: f.id } }), 'Deleted.');
                  }
                }}>
                Delete
              </button>
            </div>
          );
        })}
      </div>

      <button
        disabled={busy || files.length >= MAX_FILES}
        onClick={() => addInput.current?.click()}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {files.length >= MAX_FILES ? `Maximum ${MAX_FILES} files` : 'Add PDF'}
      </button>

      <input
        ref={addInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          void handleAdd(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          void handleReplace(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {message && (
        <p className={`text-sm mt-3 ${message.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  );
}