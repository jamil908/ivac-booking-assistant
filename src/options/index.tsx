/**
 * Options/Settings page
 */

import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExtensionSettings, ApplicantProfile } from '../types';
import { ProfileList } from '../features/profiles/ProfileList';
import { ProfileForm } from '../features/profiles/ProfileForm';

function Options() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profiles' | 'settings' | 'help'>('profiles');
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingProfile, setEditingProfile] = useState<ApplicantProfile | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsResponse, profilesResponse] = await Promise.all([
        sendMessage({ type: 'GET_SETTINGS' }),
        sendMessage({ type: 'GET_PROFILES' }),
      ]);

      setSettings(settingsResponse.data as ExtensionSettings);
      setProfiles(profilesResponse.data as ApplicantProfile[]);
      
      const storageData = await chrome.storage.local.get('ivac_data');
      const ivacData = storageData.ivac_data as { activeProfileId?: string } | undefined;
      setActiveProfileId(ivacData?.activeProfileId ?? null);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      await sendMessage({ type: 'UPDATE_SETTINGS', payload: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert('Failed to save settings');
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

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">IVAC Assistant Settings</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab('profiles');
                  setView('list');
                }}
                className={`w-full text-left px-4 py-2 rounded-md ${
                  activeTab === 'profiles'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Profiles
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full text-left px-4 py-2 rounded-md ${
                  activeTab === 'settings'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('help')}
                className={`w-full text-left px-4 py-2 rounded-md ${
                  activeTab === 'help'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Help
              </button>
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {activeTab === 'profiles' && (
                <>
                  {view === 'list' && (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">Applicant Profiles</h2>
                        <button
                          onClick={() => setView('create')}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
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
                    </>
                  )}

                  {(view === 'create' || view === 'edit') && (
                    <>
                      <div className="mb-6">
                        <button
                          onClick={() => {
                            setView('list');
                            setEditingProfile(undefined);
                          }}
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Back to list
                        </button>
                        <h2 className="text-xl font-semibold mt-4">
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
                </>
              )}

              {activeTab === 'settings' && (
                <>
                  <h2 className="text-xl font-semibold mb-6">Extension Settings</h2>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Auto-fill Login</h3>
                        <p className="text-sm text-gray-600">
                          Automatically fill login credentials when detected
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.autoFillEnabled}
                          onChange={(e) =>
                            setSettings({ ...settings, autoFillEnabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Notifications</h3>
                        <p className="text-sm text-gray-600">
                          Show notifications for OTP and important events
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.notificationsEnabled}
                          onChange={(e) =>
                            setSettings({ ...settings, notificationsEnabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">OTP Confirmation</h3>
                        <p className="text-sm text-gray-600">
                          Require user confirmation before submitting OTP
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.requireOTPConfirmation}
                          onChange={(e) =>
                            setSettings({ ...settings, requireOTPConfirmation: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Theme</h3>
                      <select
                        value={settings.theme}
                        onChange={(e) =>
                          setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'auto' })
                        }
                        className="px-3 py-2 border rounded-md"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Log Level</h3>
                      <select
                        value={settings.logLevel}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            logLevel: e.target.value as 'error' | 'warn' | 'info' | 'debug',
                          })
                        }
                        className="px-3 py-2 border rounded-md"
                      >
                        <option value="error">Error</option>
                        <option value="warn">Warning</option>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                      </select>
                    </div>

                    <div className="pt-4 border-t">
                      <button
                        onClick={handleSaveSettings}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                      >
                        {saved ? '✓ Saved' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'help' && (
                <>
                  <h2 className="text-xl font-semibold mb-6">Help & Documentation</h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium mb-2">Getting Started</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                        <li>Create an applicant profile with your visa application details</li>
                        <li>Optionally store your IVAC login credentials securely</li>
                        <li>Navigate to the IVAC booking website</li>
                        <li>Click the extension icon and use "Auto-fill Login"</li>
                        <li>Follow the on-screen prompts for OTP and document upload</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Security & Privacy</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                        <li>All data is stored locally on your device</li>
                        <li>Credentials are encrypted using industry-standard AES-256</li>
                        <li>No data is sent to external servers</li>
                        <li>You maintain full control of your information</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Limitations</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                        <li>Cannot bypass CAPTCHA or anti-bot protections</li>
                        <li>OTP must be entered manually by user</li>
                        <li>Does not guarantee appointment availability</li>
                        <li>Respects all IVAC website restrictions</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Troubleshooting</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                        <li>
                          <strong>Auto-fill not working:</strong> Ensure you're on the correct IVAC website
                          and have selected an active profile
                        </li>
                        <li>
                          <strong>Profile not saving:</strong> Check that all required fields are filled
                        </li>
                        <li>
                          <strong>Extension not loading:</strong> Try reloading the extension or restarting
                          Chrome
                        </li>
                      </ul>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600">
                        Version 1.0.0 • For support, please contact your system administrator
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function sendMessage(message: { type: string; payload?: unknown }): Promise<{ success: boolean; data?: unknown }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Options />);
}
