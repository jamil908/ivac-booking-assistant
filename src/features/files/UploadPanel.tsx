import { useEffect, useState } from 'react';
import type { StoredFileInfo } from '../../types';

type Reply = { success: boolean; data?: unknown; error?: string };
type PageState = { onUploadPage: boolean; count: number | null; slot: 'primary' | 'other' | null };

function send(message: { type: string; payload?: unknown }): Promise<Reply> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

/**
 * The active profile's saved web files with an upload icon each.
 * The icon puts that file into the open IVAC upload page (works with auto mode off).
 * Only the next file in line can be uploaded, so the primary file stays primary.
 */
export function UploadPanel({ profileId }: { profileId: string | null }) {
  const [files, setFiles] = useState<StoredFileInfo[]>([]);
  const [page, setPage] = useState<PageState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const refresh = async () => {
    if (!profileId) return;

    const list = await send({ type: 'LIST_FILES', payload: profileId });
    setFiles(list.success ? (list.data as StoredFileInfo[]) : []);
    if (!list.success) setMessage({ type: 'error', text: list.error ?? 'Could not load the files.' });

    const state = await send({ type: 'GET_UPLOAD_STATE' });
    setPage(state.success ? (state.data as PageState) : null);
  };

  useEffect(() => {
    setMessage(null);
    void refresh();
  }, [profileId]);

  const upload = async (file: StoredFileInfo) => {
    setBusy(true);
    setMessage(null);
    const res = await send({ type: 'INJECT_FILE', payload: { fileId: file.id } });
    setMessage(
      res.success
        ? { type: 'ok', text: 'File uploaded.' }
        : { type: 'error', text: res.error ?? 'The upload failed.' }
    );
    await refresh();
    setBusy(false);
  };

  if (!profileId) return null;

  const count = page?.onUploadPage ? page.count : null;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Web files</h3>
        <button onClick={() => void refresh()} className="text-xs text-blue-700 hover:underline">
          Refresh
        </button>
      </div>

      {files.length === 0 && (
        <p className="text-xs text-gray-500">No files saved. Add them in Options &gt; Files.</p>
      )}

      <div className="space-y-1">
        {files.map((f, index) => {
          const done = count !== null && index < count;
          const isNext = count !== null && index === count;
          const canUpload = isNext && f.verified && !busy;

          let status = 'Open the IVAC upload page';
          if (page?.onUploadPage) {
            if (done) status = 'Uploaded ✓';
            else if (!f.verified) status = 'Not verified (Options > Files)';
            else if (isNext) status = 'Next in line';
            else status = 'Waiting for the earlier files';
          }

          return (
            <div key={f.id} className="flex items-center gap-2 border rounded-md px-2 py-1.5">
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  f.role === 'primary' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {f.role === 'primary' ? 'Primary' : `Secondary ${index}`}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[11px] text-gray-500">{status}</div>
              </div>

              <button
                onClick={() => void upload(f)}
                disabled={!canUpload}
                title={canUpload ? 'Upload this file to IVAC' : status}
                className="p-1.5 rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 8l4-4 4 4" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {message && (
        <p className={`text-xs mt-2 ${message.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  );
}