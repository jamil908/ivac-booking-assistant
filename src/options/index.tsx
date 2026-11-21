/**
 * Options/Settings page
 */
import "../style.css";
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExtensionSettings, ApplicantProfile } from '../types';
import { ProfileList } from '../features/profiles/ProfileList';
import { ProfileForm } from '../features/profiles/ProfileForm';
import { FilesManager } from '../features/files/FilesManager';
import { LogViewer } from '../features/log/LogViewer';

function Options() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profiles' | 'files' | 'log' | 'settings' | 'help'>(
    window.location.hash === '#log' ? 'log' : 'profiles'
  );
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
    // <div className="min-h-screen   bg-gray-50">
    //   {/* Header */}
    //   <div className="bg-white border-b">
    //     <div className="max-w-6xl mx-auto px-6 py-4">
    //       <h1 className="text-2xl font-bold text-gray-900">IVAC Assistant Settings</h1>
    //     </div>
    //   </div>

    //   <div className="max-w-6xl mx-auto px-6 py-8">
    //     <div className="flex gap-8">
    //       {/* Sidebar */}
    //       <div className="w-48 flex-shrink-0">
    //         <nav className="space-y-1">
    //           <button
    //             onClick={() => {
    //               setActiveTab('profiles');
    //               setView('list');
    //             }}
    //             className={`w-full text-left px-4 py-2 rounded-md ${
    //               activeTab === 'profiles'
    //                 ? 'bg-blue-50 text-blue-700 font-medium'
    //                 : 'text-gray-700 hover:bg-gray-100'
    //             }`}
    //           >
    //             Profiles
    //           </button>
    //           <button
    //             onClick={() => setActiveTab('files')}
    //             className={`w-full text-left px-4 py-2 rounded-md ${
    //               activeTab === 'files'
    //                 ? 'bg-blue-50 text-blue-700 font-medium'
    //                 : 'text-gray-700 hover:bg-gray-100'
    //             }`}
    //           >
    //             Files
    //           </button>
    //           <button
    //             onClick={() => setActiveTab('settings')}
    //             className={`w-full text-left px-4 py-2 rounded-md ${
    //               activeTab === 'settings'
    //                 ? 'bg-blue-50 text-blue-700 font-medium'
    //                 : 'text-gray-700 hover:bg-gray-100'
    //             }`}
    //           >
    //             Settings
    //           </button>
    //           <button
    //             onClick={() => setActiveTab('help')}
    //             className={`w-full text-left px-4 py-2 rounded-md ${
    //               activeTab === 'help'
    //                 ? 'bg-blue-50 text-blue-700 font-medium'
    //                 : 'text-gray-700 hover:bg-gray-100'
    //             }`}
    //           >
    //             Help
    //           </button>
    //         </nav>
    //       </div>

    //       {/* Main content */}
    //       <div className="flex-1">
    //         <div className="bg-white rounded-lg shadow-sm p-6">
    //         {activeTab === 'files' && (
    //             <>
    //               <h2 className="text-xl font-semibold mb-4">Web Files (BGD)</h2>
    //               <FilesManager profiles={profiles} activeProfileId={activeProfileId} />
    //             </>
    //           )}
    //           {activeTab === 'profiles' && (
    //             <>
    //               {view === 'list' && (
    //                 <>
    //                   <div className="flex justify-between items-center mb-6">
    //                     <h2 className="text-xl font-semibold">Applicant Profiles</h2>
    //                     <button
    //                       onClick={() => setView('create')}
    //                       className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
    //                     >
    //                       + New Profile
    //                     </button>
    //                   </div>

    //                   <ProfileList
    //                     profiles={profiles}
    //                     activeProfileId={activeProfileId}
    //                     onSelect={handleSelectProfile}
    //                     onEdit={(profile) => {
    //                       setEditingProfile(profile);
    //                       setView('edit');
    //                     }}
    //                     onDelete={handleDeleteProfile}
    //                   />
    //                 </>
    //               )}

    //               {(view === 'create' || view === 'edit') && (
    //                 <>
    //                   <div className="mb-6">
    //                     <button
    //                       onClick={() => {
    //                         setView('list');
    //                         setEditingProfile(undefined);
    //                       }}
    //                       className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
    //                     >
    //                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    //                       </svg>
    //                       Back to list
    //                     </button>
    //                     <h2 className="text-xl font-semibold mt-4">
    //                       {view === 'create' ? 'Create New Profile' : 'Edit Profile'}
    //                     </h2>
    //                   </div>
    //                   <ProfileForm
    //                     profile={editingProfile}
    //                     onSave={handleSaveProfile}
    //                     onCancel={() => {
    //                       setView('list');
    //                       setEditingProfile(undefined);
    //                     }}
    //                   />
    //                 </>
    //               )}
    //             </>
    //           )}

    //           {activeTab === 'settings' && (
    //             <>
    //               <h2 className="text-xl font-semibold mb-6">Extension Settings</h2>

    //               <div className="space-y-6">
    //                 <div className="flex items-center justify-between">
    //                   <div>
    //                     <h3 className="font-medium">Auto-fill Login</h3>
    //                     <p className="text-sm text-gray-600">
    //                       Automatically fill login credentials when detected
    //                     </p>
    //                   </div>
    //                   <label className="relative inline-flex items-center cursor-pointer">
    //                     <input
    //                       type="checkbox"
    //                       checked={settings.autoFillEnabled}
    //                       onChange={(e) =>
    //                         setSettings({ ...settings, autoFillEnabled: e.target.checked })
    //                       }
    //                       className="sr-only peer"
    //                     />
    //                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    //                   </label>
    //                 </div>

    //                 <div className="flex items-center justify-between">
    //                   <div>
    //                     <h3 className="font-medium">Notifications</h3>
    //                     <p className="text-sm text-gray-600">
    //                       Show notifications for OTP and important events
    //                     </p>
    //                   </div>
    //                   <label className="relative inline-flex items-center cursor-pointer">
    //                     <input
    //                       type="checkbox"
    //                       checked={settings.notificationsEnabled}
    //                       onChange={(e) =>
    //                         setSettings({ ...settings, notificationsEnabled: e.target.checked })
    //                       }
    //                       className="sr-only peer"
    //                     />
    //                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    //                   </label>
    //                 </div>

    //                 <div className="flex items-center justify-between">
    //                   <div>
    //                     <h3 className="font-medium">OTP Confirmation</h3>
    //                     <p className="text-sm text-gray-600">
    //                       Require user confirmation before submitting OTP
    //                     </p>
    //                   </div>
    //                   <label className="relative inline-flex items-center cursor-pointer">
    //                     <input
    //                       type="checkbox"
    //                       checked={settings.requireOTPConfirmation}
    //                       onChange={(e) =>
    //                         setSettings({ ...settings, requireOTPConfirmation: e.target.checked })
    //                       }
    //                       className="sr-only peer"
    //                     />
    //                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    //                   </label>
    //                 </div>

    //                 <div>
    //                   <h3 className="font-medium mb-2">Theme</h3>
    //                   <select
    //                     value={settings.theme}
    //                     onChange={(e) =>
    //                       setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'auto' })
    //                     }
    //                     className="px-3 py-2 border rounded-md"
    //                   >
    //                     <option value="light">Light</option>
    //                     <option value="dark">Dark</option>
    //                     <option value="auto">Auto</option>
    //                   </select>
    //                 </div>

    //                 <div>
    //                   <h3 className="font-medium mb-2">Log Level</h3>
    //                   <select
    //                     value={settings.logLevel}
    //                     onChange={(e) =>
    //                       setSettings({
    //                         ...settings,
    //                         logLevel: e.target.value as 'error' | 'warn' | 'info' | 'debug',
    //                       })
    //                     }
    //                     className="px-3 py-2 border rounded-md"
    //                   >
    //                     <option value="error">Error</option>
    //                     <option value="warn">Warning</option>
    //                     <option value="info">Info</option>
    //                     <option value="debug">Debug</option>
    //                   </select>
    //                 </div>

    //                 <div className="pt-4 border-t">
    //                   <button
    //                     onClick={handleSaveSettings}
    //                     className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
    //                   >
    //                     {saved ? '✓ Saved' : 'Save Settings'}
    //                   </button>
    //                 </div>
    //               </div>
    //             </>
    //           )}

    //           {activeTab === 'help' && (
    //             <>
    //               <h2 className="text-xl font-semibold mb-6">Help & Documentation</h2>

    //               <div className="space-y-6">
    //                 <div>
    //                   <h3 className="font-medium mb-2">Getting Started</h3>
    //                   <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
    //                     <li>Create an applicant profile with your visa application details</li>
    //                     <li>Optionally store your IVAC login credentials securely</li>
    //                     <li>Navigate to the IVAC booking website</li>
    //                     <li>Click the extension icon and use "Auto-fill Login"</li>
    //                     <li>Follow the on-screen prompts for OTP and document upload</li>
    //                   </ol>
    //                 </div>

    //                 <div>
    //                   <h3 className="font-medium mb-2">Security & Privacy</h3>
    //                   <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
    //                     <li>All data is stored locally on your device</li>
    //                     <li>Credentials are encrypted using industry-standard AES-256</li>
    //                     <li>No data is sent to external servers</li>
    //                     <li>You maintain full control of your information</li>
    //                   </ul>
    //                 </div>

    //                 <div>
    //                   <h3 className="font-medium mb-2">Limitations</h3>
    //                   <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
    //                     <li>Cannot bypass CAPTCHA or anti-bot protections</li>
    //                     <li>OTP must be entered manually by user</li>
    //                     <li>Does not guarantee appointment availability</li>
    //                     <li>Respects all IVAC website restrictions</li>
    //                   </ul>
    //                 </div>

    //                 <div>
    //                   <h3 className="font-medium mb-2">Troubleshooting</h3>
    //                   <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
    //                     <li>
    //                       <strong>Auto-fill not working:</strong> Ensure you're on the correct IVAC website
    //                       and have selected an active profile
    //                     </li>
    //                     <li>
    //                       <strong>Profile not saving:</strong> Check that all required fields are filled
    //                     </li>
    //                     <li>
    //                       <strong>Extension not loading:</strong> Try reloading the extension or restarting
    //                       Chrome
    //                     </li>
    //                   </ul>
    //                 </div>

    //                 <div className="pt-4 border-t">
    //                   <p className="text-sm text-gray-600">
    //                     Version 1.0.0 • For support, please contact your system administrator
    //                   </p>
    //                 </div>
    //               </div>
    //             </>
    //           )}
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    // </div>
    <div className="min-h-screen bg-[#F7F3ED] text-[#332A29]">
      {/* Header */}
      <div className="bg-[#FFFCF8] border-b border-[#E8DDD5] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#542638]">IVAC Assistant Settings</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-56 flex-shrink-0">
            <nav className="space-y-2">
              <button
                onClick={() => {
                  setActiveTab('profiles');
                  setView('list');
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  activeTab === 'profiles'
                    ? 'bg-[#F0E4E6] text-[#722F45] shadow-sm border border-[#E7D4D9]'
                    : 'text-[#6F6260] hover:bg-[#F0E8E1] hover:text-[#542638]'
                }`}
              >
                Profiles
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  activeTab === 'files'
                    ? 'bg-[#F0E4E6] text-[#722F45] shadow-sm border border-[#E7D4D9]'
                    : 'text-[#6F6260] hover:bg-[#F0E8E1] hover:text-[#542638]'
                }`}
              >
                Files
              </button>
              <button
                onClick={() => setActiveTab('log')}
                className={`w-full text-left px-4 py-2 rounded-md ${
                  activeTab === 'log'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Log
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  activeTab === 'settings'
                    ? 'bg-[#F0E4E6] text-[#722F45] shadow-sm border border-[#E7D4D9]'
                    : 'text-[#6F6260] hover:bg-[#F0E8E1] hover:text-[#542638]'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('help')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  activeTab === 'help'
                    ? 'bg-[#F0E4E6] text-[#722F45] shadow-sm border border-[#E7D4D9]'
                    : 'text-[#6F6260] hover:bg-[#F0E8E1] hover:text-[#542638]'
                }`}
              >
                Help
              </button>
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="bg-[#FFFCF8] rounded-2xl shadow-[0_8px_30px_rgba(73,45,45,0.06)] border border-[#EDE3DA] p-6 md:p-8">
              {activeTab === 'log' && (
                <>
                  <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
                  <LogViewer />
                </>
              )}
            {activeTab === 'files' && (
                <>
                  <h2 className="text-xl font-semibold mb-5 text-[#542638]">Web Files (BGD)</h2>
                  <FilesManager profiles={profiles} activeProfileId={activeProfileId} />
                </>
              )}
              {activeTab === 'profiles' && (
                <>
                  {view === 'list' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                        <h2 className="text-xl font-semibold">Applicant Profiles</h2>
                        <button
                          onClick={() => setView('create')}
                          className="bg-[#722F45] text-white px-5 py-2.5 rounded-xl hover:bg-[#5B2437] shadow-sm hover:shadow-md transition-all duration-200 font-medium"
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
                          className="text-[#722F45] hover:text-[#542638] flex items-center gap-2 font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Back to list
                        </button>
                        <h2 className="text-xl font-semibold mt-4 text-[#542638]">
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
                  <h2 className="text-xl font-semibold mb-6 text-[#542638]">Extension Settings</h2>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#EDE3DA] bg-[#FBF7F2] p-4 sm:p-5">
                      <div>
                        <h3 className="font-medium">Auto-fill Login</h3>
                        <p className="text-sm text-[#817371] leading-relaxed">
                          Automatically fill login credentials when detected
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.autoFillEnabled}
                          onChange={(e) =>
                            setSettings({ ...settings, autoFillEnabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#DDD2CC] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#EAD9DE] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8C9C2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#722F45]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#EDE3DA] bg-[#FBF7F2] p-4 sm:p-5">
                      <div>
                        <h3 className="font-medium">Notifications</h3>
                        <p className="text-sm text-[#817371] leading-relaxed">
                          Show notifications for OTP and important events
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.notificationsEnabled}
                          onChange={(e) =>
                            setSettings({ ...settings, notificationsEnabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#DDD2CC] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#EAD9DE] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8C9C2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#722F45]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#EDE3DA] bg-[#FBF7F2] p-4 sm:p-5">
                      <div>
                        <h3 className="font-medium">OTP Confirmation</h3>
                        <p className="text-sm text-[#817371] leading-relaxed">
                          Require user confirmation before submitting OTP
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.requireOTPConfirmation}
                          onChange={(e) =>
                            setSettings({ ...settings, requireOTPConfirmation: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#DDD2CC] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#EAD9DE] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D8C9C2] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#722F45]"></div>
                      </label>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-[#493638]">Theme</h3>
                      <select
                        value={settings.theme}
                        onChange={(e) =>
                          setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'auto' })
                        }
                        className="px-4 py-2.5 border border-[#DED1C8] rounded-xl bg-[#FFFCF8] text-[#493638] focus:outline-none focus:ring-2 focus:ring-[#C69AA7] focus:border-[#A45B70] transition"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-[#493638]">Log Level</h3>
                      <select
                        value={settings.logLevel}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            logLevel: e.target.value as 'error' | 'warn' | 'info' | 'debug',
                          })
                        }
                        className="px-4 py-2.5 border border-[#DED1C8] rounded-xl bg-[#FFFCF8] text-[#493638] focus:outline-none focus:ring-2 focus:ring-[#C69AA7] focus:border-[#A45B70] transition"
                      >
                        <option value="error">Error</option>
                        <option value="warn">Warning</option>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                      </select>
                    </div>

                    <div className="pt-5 border-t border-[#E8DDD5]">
                      <button
                        onClick={handleSaveSettings}
                        className="bg-[#722F45] text-white px-6 py-2.5 rounded-xl hover:bg-[#5B2437] shadow-sm hover:shadow-md transition-all duration-200 font-semibold"
                      >
                        {saved ? '✓ Saved' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'help' && (
                <>
                  <h2 className="text-xl font-semibold mb-6 text-[#542638]">Help & Documentation</h2>

                  <div className="space-y-5">
                    <div>
                      <h3 className="font-semibold mb-2 text-[#493638]">Getting Started</h3>
                      <ol className="list-decimal list-inside space-y-3 text-sm text-[#6F6260] leading-relaxed">
                        <li>Create an applicant profile with your visa application details</li>
                        <li>Optionally store your IVAC login credentials securely</li>
                        <li>Navigate to the IVAC booking website</li>
                        <li>Click the extension icon and use "Auto-fill Login"</li>
                        <li>Follow the on-screen prompts for OTP and document upload</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-[#493638]">Security & Privacy</h3>
                      <ul className="list-disc list-inside space-y-3 text-sm text-[#6F6260] leading-relaxed">
                        <li>All data is stored locally on your device</li>
                        <li>Credentials are encrypted using industry-standard AES-256</li>
                        <li>No data is sent to external servers</li>
                        <li>You maintain full control of your information</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-[#493638]">Limitations</h3>
                      <ul className="list-disc list-inside space-y-3 text-sm text-[#6F6260] leading-relaxed">
                        <li>Cannot bypass CAPTCHA or anti-bot protections</li>
                        <li>OTP must be entered manually by user</li>
                        <li>Does not guarantee appointment availability</li>
                        <li>Respects all IVAC website restrictions</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-[#493638]">Troubleshooting</h3>
                      <ul className="list-disc list-inside space-y-3 text-sm text-[#6F6260] leading-relaxed">
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

                    <div className="pt-5 border-t border-[#E8DDD5]">
                      <p className="text-sm text-[#817371] leading-relaxed">
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
