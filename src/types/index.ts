/**
 * Core type definitions for IVAC extension
 */

export type VisaType = 'tourist' | 'business' | 'medical' | 'student' | 'other';
export type VisaCenter = 'dhaka' | 'chittagong' | 'sylhet';
export type ApplicationStatus = 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected';

export interface ApplicantProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  visaType: VisaType;
  center: VisaCenter;
  
  // Login credentials (encrypted in storage)
  ivacUsername?: string;
  ivacPassword?: string;
  
  // Document references
  documents: DocumentReference[];
  
  // Booking preferences
  preferredDates: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
}

export interface DocumentReference {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  dataUrl: string; // base64 encoded for storage
  uploadedAt: string;
  expiresAt?: string; // For documents with validity periods
  issuedAt?: string; // For documents with issue dates
}

export type DocumentType = 
  | 'passport'
  | 'photo'
  | 'invitation_letter'
  | 'hotel_booking'
  | 'flight_ticket'
  | 'bank_statement'
  | 'employment_letter'
  | 'other';

export interface BookingState {
  profileId: string;
  windowId?: number;
  tabId?: number;
  currentStep: BookingStep;
  sessionId?: string;
  loginAttempts: number;
  otpRequested: boolean;
  otpExpiresAt?: string;
  documentsUploaded: string[]; // document IDs
  selectedCentre?: VisaCenter;
  selectedDate?: string;
  selectedTimeSlot?: string;
  paymentInfo?: PaymentInfo;
  confirmationNumber?: string;
  invoiceUrl?: string;
  errors: string[];
  isPaused: boolean;
  needsManualAction: boolean;
  manualActionMessage?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export type BookingStep = 
  | 'locked'
  | 'profile_selected'
  | 'login_ready'
  | 'login_submitted'
  | 'otp_required'
  | 'authenticated'
  | 'booking_started'
  | 'documents_ready'
  | 'documents_uploaded'
  | 'ivac_centre_selected'
  | 'appointment_date_selected'
  | 'booking_review'
  | 'payment_page'
  | 'payment_pending'
  | 'payment_success'
  | 'confirmation_verified'
  | 'invoice_saved'
  | 'paused'
  | 'session_expired'
  | 'slot_unavailable'
  | 'upload_failed'
  | 'payment_failed'
  | 'needs_manual_action'
  | 'unknown_status'
  | 'error';

export interface PaymentInfo {
  amount: string;
  currency: string;
  transactionId?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  paymentStatus: 'pending' | 'success' | 'failed' | 'unknown';
  verifiedAt?: string;
  gatewayReference?: string;
}

export interface StorageData {
  profiles: Record<string, ApplicantProfile>;
  activeProfileId?: string;
  bookingStates: Record<string, BookingState>; // Per profile/window
  settings: ExtensionSettings;
  isLocked: boolean; // Extension lock state
  lastActivity?: string; // For inactivity timeout
}

export interface ExtensionSettings {
  autoFillEnabled: boolean;
  notificationsEnabled: boolean;
  requireOTPConfirmation: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  theme: 'light' | 'dark' | 'auto';
  inactivityLockMinutes: number; // Auto-lock after inactivity
  maxConcurrentWindows: number; // Limit parallel bookings
  sessionTimeoutMinutes: number;
}

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export type MessageType =
  | 'GET_PROFILES'
  | 'SAVE_PROFILE'
  | 'DELETE_PROFILE'
  | 'SET_ACTIVE_PROFILE'
  | 'GET_BOOKING_STATE'
  | 'GET_ALL_BOOKING_STATES'
  | 'UPDATE_BOOKING_STATE'
  | 'AUTOFILL_LOGIN'
  | 'REQUEST_OTP'
  | 'SUBMIT_OTP'
  | 'SUBMIT_DOCUMENTS'
  | 'SELECT_DATE'
  | 'VERIFY_PAYMENT'
  | 'RESET_BOOKING'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'LOCK_EXTENSION'
  | 'UNLOCK_EXTENSION'
  | 'CHECK_LOCK_STATUS'
  | 'CREATE_BOOKING_WINDOW'
  | 'PAUSE_BOOKING'
  | 'RESUME_BOOKING'
  | 'CLEAR_ALL_DATA';

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
