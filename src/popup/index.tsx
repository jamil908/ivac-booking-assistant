/**
 * Popup UI - Quick access dashboard
 */

import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { ApplicantProfile, BookingState } from "../types";
import { ProfileList } from "../features/profiles/ProfileList";
import { ProfileForm } from "../features/profiles/ProfileForm";
import "./popup.css";
import { UploadPanel } from '../features/files/UploadPanel';
const AUTOMATION_KEY = 'ivac_automation_running'; // keep identical to src/content/autoClick.ts
function Popup() {
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [view, setView] = useState<
    "list" | "create" | "edit" | "unlock" | "setup"
  >("unlock");
  const [editingProfile, setEditingProfile] = useState<
    ApplicantProfile | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMessage, setOtpMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{
    type: "ok" | "warn" | "error";
    text: string;
  } | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);

useEffect(() => {
  chrome.storage.local
    .get(AUTOMATION_KEY)
    .then((r) => setAutoRunning(r[AUTOMATION_KEY] === true));

  // এক্সটেনশন নিজে Pause হলে বাটনও নিজে বদলে যাবে
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && AUTOMATION_KEY in changes) {
      setAutoRunning(changes[AUTOMATION_KEY]?.newValue === true);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}, []);

const toggleAutomation = async () => {
  const next = !autoRunning;
  setAutoRunning(next);
  await chrome.storage.local.set({ [AUTOMATION_KEY]: next });
};
  useEffect(() => {
    checkLockStatus();
  }, []);

  const checkLockStatus = async () => {
    try {
      const status = await sendMessage({ type: "CHECK_LOCK_STATUS" });
      const lockState = status.data as {
        isLocked: boolean;
        hasPassword: boolean;
      };

      if (!lockState.isLocked) {
        setView("list");
        await loadData();
      } else if (!lockState.hasPassword) {
        setView("setup");
      } else {
        setView("unlock");
      }
    } catch (error) {
      console.error("Failed to check lock status:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleSetMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError("");

    if (password.length < 8) {
      setUnlockError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setUnlockError("Passwords do not match.");
      return;
    }

    try {
      const result = await sendMessage({
        type: "SET_MASTER_PASSWORD",
        payload: password,
      });

      if (!result.success) {
        setUnlockError(result.error || "Failed to set master password.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setView("list");
      await loadData();
    } catch (error) {
      setUnlockError(
        error instanceof Error
          ? error.message
          : "Failed to set master password.",
      );
    }
  };
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError("");

    try {
      const result = await sendMessage({
        type: "UNLOCK_EXTENSION",
        payload: password,
      });

      if (result.data === true) {
        setView("list");
        setPassword("");
        await loadData();
      } else {
        setUnlockError("Incorrect password");
      }
    } catch (error) {
      setUnlockError(
        error instanceof Error ? error.message : "Failed to unlock",
      );
    }
  };

  const handleLock = async () => {
    try {
      await sendMessage({ type: "LOCK_EXTENSION" });
      setView("unlock");
      setProfiles([]);
    } catch (error) {
      alert("Failed to lock extension");
    }
  };
  const refreshBookingState = async (profileId: string) => {
    const res = await sendMessage({
      type: "GET_BOOKING_STATE",
      payload: profileId,
    });
    setBookingState((res.data as BookingState) ?? null);
  };
  const loadData = async () => {
    try {
      const storageData = await chrome.storage.local.get("ivac_data");
      const ivacData = storageData.ivac_data as
        | { activeProfileId?: string }
        | undefined;
      const activeId = ivacData?.activeProfileId ?? null;

      const [profilesResponse, bookingResponse] = await Promise.all([
        sendMessage({ type: "GET_PROFILES" }),
        activeId
          ? sendMessage({ type: "GET_BOOKING_STATE", payload: activeId })
          : Promise.resolve({ data: null }),
      ]);

      setProfiles((profilesResponse.data as ApplicantProfile[]) || []);
      setBookingState((bookingResponse.data as BookingState) || null);
      setActiveProfileId(activeId);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSelectProfile = async (id: string) => {
    try {
      await sendMessage({ type: "SET_ACTIVE_PROFILE", payload: id });
      setActiveProfileId(id);
      setOtp("");
      setOtpMessage(null);
      await refreshBookingState(id);
    } catch (error) {
      alert("Failed to select profile");
    }
  };

  const handleSaveProfile = async (
    profile: Omit<ApplicantProfile, "id" | "createdAt" | "updatedAt">,
  ) => {
    try {
      const payload = editingProfile
        ? { ...profile, id: editingProfile.id }
        : profile;

      await sendMessage({ type: "SAVE_PROFILE", payload });
      await loadData();
      setView("list");
      setEditingProfile(undefined);
    } catch (error) {
      throw new Error("Failed to save profile");
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await sendMessage({ type: "DELETE_PROFILE", payload: id });
      await loadData();
    } catch (error) {
      alert("Failed to delete profile");
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };
  const isDetached =
    new URLSearchParams(window.location.search).get("detached") === "1";

  const handleDetach = async () => {
    await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html") + "?detached=1",
      type: "popup",
      width: 440,
      height: 700,
    });
    window.close();
  };
  const handleAutofill = async () => {
    if (!activeProfileId) {
      alert("Please select a profile first");
      return;
    }

    try {
      await sendMessage({ type: "AUTOFILL_LOGIN", payload: activeProfileId });
      if (!isDetached) window.close();
    } catch (error) {
      alert("Failed to autofill. Make sure you are on the IVAC website.");
    }
  };
  const handleStartOtp = async () => {
    if (!activeProfileId) return;
    setOtpBusy(true);
    setOtpMessage(null);

    const res = await sendMessage({
      type: "REQUEST_OTP",
      payload: activeProfileId,
    });

    if (res.success) {
      setOtpMessage({
        type: "ok",
        text: "OTP window started (5 minutes). Enter the OTP you received.",
      });
      await refreshBookingState(activeProfileId);
    } else {
      setOtpMessage({
        type: "error",
        text: res.error ?? "Could not start OTP.",
      });
    }
    setOtpBusy(false);
  };

  const handleFillOtp = async () => {
    if (!activeProfileId) return;

    if (!/^\d{4,6}$/.test(otp)) {
      setOtpMessage({ type: "error", text: "Enter a valid 4–6 digit OTP." });
      return;
    }

    setOtpBusy(true);
    setOtpMessage(null);

    const res = await sendMessage({
      type: "SUBMIT_OTP",
      payload: { profileId: activeProfileId, otp },
    });

    if (res.success) {
      setOtp("");
      setOtpMessage({
        type: "ok",
        text: "OTP filled on the IVAC page. Review it and click Submit yourself.",
      });
      await refreshBookingState(activeProfileId);
    } else {
      setOtpMessage({
        type: "error",
        text: res.error ?? "Could not fill OTP.",
      });
    }
    setOtpBusy(false);
  };
  const handleCheckPayment = async () => {
    if (!activeProfileId) return;
    setPaymentBusy(true);
    setPaymentMessage(null);

    const res = await sendMessage({
      type: "CHECK_PAYMENT_STATUS",
      payload: activeProfileId,
    });

    if (res.success) {
      const data = res.data as {
        status: string;
        message: string;
        confirmationNumber?: string;
        amount?: string;
      };
      const details = [
        data.confirmationNumber && `Ref: ${data.confirmationNumber}`,
        data.amount && `Amount: ${data.amount}`,
      ]
        .filter(Boolean)
        .join(" · ");

      setPaymentMessage({
        type:
          data.status === "success"
            ? "ok"
            : data.status === "failed"
              ? "error"
              : "warn",
        text: details ? `${data.message} ${details}` : data.message,
      });
      await refreshBookingState(activeProfileId);
    } else {
      setPaymentMessage({
        type: "error",
        text: res.error ?? "Could not check payment status.",
      });
    }
    setPaymentBusy(false);
  };

  const handleSaveInvoice = async () => {
    if (!activeProfileId) return;
    setPaymentBusy(true);
    setPaymentMessage(null);

    const res = await sendMessage({
      type: "SAVE_INVOICE",
      payload: activeProfileId,
    });

    if (res.success) {
      setPaymentMessage({
        type: "ok",
        text: "Invoice download started. Check your Downloads folder.",
      });
      await refreshBookingState(activeProfileId);
    } else {
      setPaymentMessage({
        type: "error",
        text: res.error ?? "Could not save invoice.",
      });
    }
    setPaymentBusy(false);
  };

  const otpActive =
    !!bookingState?.otpRequested &&
    !!bookingState.otpExpiresAt &&
    Date.parse(bookingState.otpExpiresAt) > Date.now();
  if (loading) {
    return (
      <div className="w-96 h-64 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (view === "setup") {
    return (
      <div className="popup-shell w-full ">
        <div className="popup-header">
          <h1 className="text-lg font-bold">IVAC Assistant</h1>
          <p className="text-sm opacity-90">Create Master Password</p>
        </div>

        <div className="popup-panel">
          <p className="text-sm text-gray-600 mb-4">
            Create a password of at least 8 characters.
          </p>

          <form onSubmit={handleSetMasterPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Master Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block popup-primary-button text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter password again"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            {unlockError && (
              <p className="text-sm text-red-600">{unlockError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md"
            >
              Set Master Password
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === "unlock") {
    return (
      <div className="w-full max-h-[600px] overflow-y-auto">
        <div className="popup-header">
          <h1 className="text-lg text-red-500 font-bold">IVAC Assistant</h1>
          <p className="text-sm opacity-90">Extension Locked</p>
        </div>
        <div className="popup-panel">
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Master Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to unlock"
                autoFocus
                className=" popup-input w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {unlockError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                {unlockError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Unlock
            </button>

            <p className="text-xs text-gray-500 text-center">
              All sensitive data is encrypted. Unlock to access your profiles.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 max-h-[600px] overflow-y-auto">
      {/* Header */}
      <div className="popup-header">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg text-red-500 font-bold">IVAC Assistant</h1>
          {!isDetached && (
            <button
              onClick={handleDetach}
              className="p-1 hover:bg-blue-500 rounded"
              title="Open in movable window"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleLock}
              className="p-1 hover:bg-blue-500 rounded"
              title="Lock Extension"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </button>
            <button
              onClick={handleOpenOptions}
              className="p-1 hover:bg-blue-500 rounded"
              title="Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
        {bookingState && (
          <div className="text-xs bg-blue-500 px-2 py-1 rounded">
            Status: {bookingState.currentStep.replace(/_/g, " ")}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {view === "list" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Applicant Profiles</h2>
              <button
                onClick={() => setView("create")}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + New Profile
              </button>
            </div>

            <ProfileList
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSelect={handleSelectProfile}
              onEdit={(profile) => {
                setEditingProfile(profile);
                setView("edit");
              }}
              onDelete={handleDeleteProfile}
            />

            {activeProfileId && (
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={handleAutofill}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Auto-fill Login
                </button>
                <div className="mt-4 pt-4 border-t">
  <button
    onClick={toggleAutomation}
    className={`w-full py-2 px-4 rounded-md text-white ${
      autoRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
    }`}
  >
    {autoRunning ? '⏸ Pause auto-click' : '▶ Start auto-click'}
  </button>
  <p className="text-xs text-gray-600 mt-1">
    {autoRunning
      ? 'Running: after Auto-fill / Fill OTP, the Sign In / Verify OTP button is clicked once.'
      : 'Paused: fields are filled and the button is only highlighted.'}
  </p>
</div>
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2">OTP</h3>

                  {!otpActive ? (
                    <button
                      onClick={handleStartOtp}
                      disabled={otpBusy}
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Start OTP (5 min)
                    </button>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600 mb-2">
                        Valid until{" "}
                        {new Date(
                          bookingState!.otpExpiresAt!,
                        ).toLocaleTimeString()}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={otp}
                          onChange={(e) =>
                            setOtp(e.target.value.replace(/\D/g, ""))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleFillOtp();
                          }}
                          placeholder="Enter OTP"
                          className="flex-1 border rounded-md px-3 py-2 tracking-widest"
                        />
                        <button
                          onClick={handleFillOtp}
                          disabled={otpBusy || otp.length < 4}
                          className="bg-green-600 text-white px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          Fill OTP
                        </button>
                      </div>
                    </>
                  )}

                  {otpMessage && (
                    <p
                      className={`text-xs mt-2 ${otpMessage.type === "ok" ? "text-green-700" : "text-red-600"}`}
                    >
                      {otpMessage.text}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2">
                    Payment &amp; Invoice
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCheckPayment}
                      disabled={paymentBusy}
                      className="flex-1 bg-slate-700 text-white py-2 px-3 rounded-md hover:bg-slate-800 disabled:opacity-50 text-sm"
                    >
                      Check Status
                    </button>
                    <button
                      onClick={handleSaveInvoice}
                      disabled={paymentBusy}
                      className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      Save Invoice
                    </button>
                  </div>

                  {paymentMessage && (
                    <p
                      className={`text-xs mt-2 ${
                        paymentMessage.type === "ok"
                          ? "text-green-700"
                          : paymentMessage.type === "warn"
                            ? "text-amber-700"
                            : "text-red-600"
                      }`}
                    >
                      {paymentMessage.text}
                    </p>
                  )}

                  <p className="text-[11px] text-gray-500 mt-2">
                    Read-only check based on page text. Always confirm payment
                    through the official IVAC channel.
                  </p>
                </div>
              </div>
            )}
            <UploadPanel profileId={activeProfileId} />

            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('options.html#log') })}
                className="w-full border py-2 px-4 rounded-md text-sm hover:bg-gray-50"
              >
                Open activity log
              </button>
            </div>
          </>
        )}

        {(view === "create" || view === "edit") && (
          <>
            <div className="mb-4">
              <h2 className="font-semibold">
                {view === "create" ? "Create New Profile" : "Edit Profile"}
              </h2>
            </div>
            <ProfileForm
              profile={editingProfile}
              onSave={handleSaveProfile}
              onCancel={() => {
                setView("list");
                setEditingProfile(undefined);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to send messages to background
function sendMessage(message: {
  type: string;
  payload?: unknown;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// Mount app
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Popup />);
}
