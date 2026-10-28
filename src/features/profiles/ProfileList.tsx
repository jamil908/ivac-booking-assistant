/**
 * Profile list component with selection and management
 */

import type { ApplicantProfile } from '../../types';

interface ProfileListProps {
  profiles: ApplicantProfile[];
  activeProfileId?: string | null;
  onSelect: (id: string) => void;
  onEdit: (profile: ApplicantProfile) => void;
  onDelete: (id: string) => void;
}

export function ProfileList({
  profiles,
  activeProfileId,
  onSelect,
  onEdit,
  onDelete,
}: ProfileListProps) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="mb-2">No profiles yet</p>
        <p className="text-sm">Create your first applicant profile to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => {
        const isActive = profile.id === activeProfileId;
        
        return (
          <div
            key={profile.id}
            className={`
              border rounded-lg p-4 cursor-pointer transition-all
              ${isActive
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
            `}
            onClick={() => onSelect(profile.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{profile.name}</h3>
                  {isActive && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p>Passport: {profile.passportNumber}</p>
                  <p>
                    {profile.visaType.charAt(0).toUpperCase() + profile.visaType.slice(1)} visa • {' '}
                    {profile.center.charAt(0).toUpperCase() + profile.center.slice(1)}
                  </p>
                  {profile.ivacUsername && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Credentials stored
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onEdit(profile)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete profile for ${profile.name}?`)) {
                      onDelete(profile.id);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete profile"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {profile.lastUsed && (
              <p className="text-xs text-gray-400 mt-2">
                Last used: {new Date(profile.lastUsed).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
