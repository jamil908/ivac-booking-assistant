/**
 * Profile creation/edit form component
 */

import React, { useState } from 'react';
import type { ApplicantProfile, VisaType, VisaCenter } from '../../types';

interface ProfileFormProps {
  profile?: ApplicantProfile;
  onSave: (profile: Omit<ApplicantProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export function ProfileForm({ profile, onSave, onCancel }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    name: profile?.name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    passportNumber: profile?.passportNumber ?? '',
    nationality: profile?.nationality ?? '',
    dateOfBirth: profile?.dateOfBirth ?? '',
    visaType: profile?.visaType ?? 'tourist' as VisaType,
    center: profile?.center ?? 'dhaka' as VisaCenter,
    ivacUsername: profile?.ivacUsername ?? '',
    ivacPassword: profile?.ivacPassword ?? '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave({
        ...formData,
        documents: profile?.documents ?? [],
        preferredDates: profile?.preferredDates ?? [],
        lastUsed: profile?.lastUsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Full Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Phone *
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Passport Number *
          </label>
          <input
            type="text"
            name="passportNumber"
            value={formData.passportNumber}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Nationality *
          </label>
          <input
            type="text"
            name="nationality"
            value={formData.nationality}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Date of Birth *
        </label>
        <input
          type="date"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Visa Type *
          </label>
          <select
            name="visaType"
            value={formData.visaType}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="tourist">Tourist</option>
            <option value="business">Business</option>
            <option value="medical">Medical</option>
            <option value="student">Student</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Visa Center *
          </label>
          <select
            name="center"
            value={formData.center}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="dhaka">Dhaka</option>
            <option value="chittagong">Chittagong</option>
            <option value="sylhet">Sylhet</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="text-sm font-medium mb-3">
          IVAC Login Credentials (Optional)
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Store your credentials securely for auto-fill. They are encrypted and never leave your device.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              IVAC Username/Email
            </label>
            <input
              type="text"
              name="ivacUsername"
              value={formData.ivacUsername}
              onChange={handleChange}
              autoComplete="off"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              IVAC Password
            </label>
            <input
              type="password"
              name="ivacPassword"
              value={formData.ivacPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
