/**
 * Popup UI - Quick access dashboard
 */

import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { ApplicantProfile, BookingState } from '../types';
import { ProfileList } from '../features/profiles/ProfileList';
import { ProfileForm } from '../features/profiles/ProfileForm';

function Popup() {
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'unlock'>('unlock');
  const [editingProfile, setEditingProfile] = useState<ApplicantProfile | undefined>();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  useEffect(() => {
    checkLockStatus();
  }, []);

  const checkLockStatus = async () => {
    try {
      const status = await sendMessage({ type: 'CHECK_LOCK_STATUS' });
      const lockState = status.data as { isLocked: boolean; hasPassword: boolean };
      
      setLocked(lockState.isLocked);
      
      if (!lockState.isLocked) {
        setView('list');
        await loadData();
      } else {
        setView('unlock');
      }
    } catch (error) {
      console.error('Failed to check lock status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    
    try {
      const result = await sendMessage({ type: 'UNLOCK_EXTENSION', payload: password });
      
      if (result.data === true) {
        setLocked(false);
        setView('list');
        setPassword('');
        await loadData();
      } else {
        setUnlockError('Incorrect password');
      }
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock');
    }
  };

  const handleLock = async () => {
    try {
      await sendMessage({ type: 'LOCK_EXTENSION' });
      setLocked(true);
      setView('unlock');
      setProfiles([]);
    } catch (error) {
      alert('Failed to lock extension');
    }
  };

  const loadData = async () => {
    try {
      const [profilesResponse, bookingResponse] = await Promise.all([
        sendMessage({ type: 'GET_PROFILES' }),
        activeProfileId ? sendMessage({ type: 'GET_BOOKING_STATE', payload: activeProfileId }) : Promise.resolve({ data: null }),
      ]);

      setProfiles(profilesResponse.data as ApplicantProfile[] || []);
      setBookingState(bookingResponse.data as BookingState || null);
      
      const storageData = await chrome.storage.local.get('ivac_data');
      const ivacData = storageData.ivac_data as { activeProfileId?: string } | undefined;
      setActiveProfileId(ivacData?.activeProfileId ?? null);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSelectProfile = async (id: string) => {
    try {
      await sendMessage({ type: 'SET_ACTIVE_PROFILE', payload: id });
      setActiveProfileId(id);
    } catch (error) {
      alert('Failed to select profile');
    }
  };

  const handleSaveProfile = async (
    profile: Omit<ApplicantProfile, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      const payload = editingProfile
        ? { ...profile, id: editingProfile.id }
        : profile;
      
      await sendMessage({ type: 'SAVE_PROFILE', payload });
      await loadData();
      setView('list');
      setEditingProfile(undefined);
    } catch (error) {
      throw new Error('Failed to save profile');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await sendMessage({ type: 'DELETE_PROFILE', payload: id });
      await loadData();
    } catch (error) {
      alert('Failed to delete profile');
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleAutofill = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    try {
      await sendMessage({ type: 'AUTOFILL_LOGIN', payload: activeProfileId });
      window.close();
    } catch (error) {
      alert('Failed to autofill. Make sure you are on the IVAC website.');
    }
  };

  if (loading) {
    return (
      <div className="w-96 h-64 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (view === 'unlock') {
    return (
      <div className="w-96">
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-lg font-bold">IVAC Assistant</h1>
          <p className="text-sm opacity-90">Extension Locked</p>
        </div>
        <div className="p-6">
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
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">IVAC Assistant</h1>
          <div className="flex gap-2">
            <button
              onClick={handleLock}
              className="p-1 hover:bg-blue-500 rounded"
              title="Lock Extension"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
            <button
              onClick={handleOpenOptions}
              className="p-1 hover:bg-blue-500 rounded"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        {bookingState && (
          <div className="text-xs bg-blue-500 px-2 py-1 rounded">
            Status: {bookingState.currentStep.replace(/_/g, ' ')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {view === 'list' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Applicant Profiles</h2>
              <button
                onClick={() => setView('create')}
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
                setView('edit');
              }}
              onDelete={handleDeleteProfile}
            />

            {activeProfileId && (
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={handleAutofill}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Auto-fill Login
                </button>
              </div>
            )}
          </>
        )}

        {(view === 'create' || view === 'edit') && (
          <>
            <div className="mb-4">
              <h2 className="font-semibold">
                {view === 'create' ? 'Create New Profile' : 'Edit Profile'}
              </h2>
            </div>
            <ProfileForm
              profile={editingProfile}
              onSave={handleSaveProfile}
              onCancel={() => {
                setView('list');
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
function sendMessage(message: { type: string; payload?: unknown }): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// Mount app
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}
