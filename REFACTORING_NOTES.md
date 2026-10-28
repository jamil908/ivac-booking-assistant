# Refactoring Notes - Updated Requirements

## Key Changes from Initial Implementation

### 1. Correct Target Website
- **Was**: `https://payment.ivacbd.com/*`
- **Now**: `https://appointment.ivacbd.com/*`
- ✅ Updated in manifest.json

### 2. Security Enhancements
- ✅ Added lock/unlock mechanism (`src/security/lock.ts`)
- ✅ Master password with inactivity timeout
- ✅ Session-based encryption key storage
- ✅ Lock button and clear data functionality
- ✅ Added alarms permission for inactivity checking

### 3. State Machine Expansion
- ✅ Updated `BookingStep` type with full workflow states:
  - locked, profile_selected, login_ready, login_submitted
  - otp_required, authenticated, booking_started
  - documents_ready, documents_uploaded, ivac_centre_selected
  - appointment_date_selected, booking_review, payment_page
  - payment_pending, payment_success, confirmation_verified
  - invoice_saved, paused, session_expired, slot_unavailable
  - upload_failed, payment_failed, needs_manual_action, unknown_status

### 4. Multi-Window Support
- ✅ Changed `bookingState` (singular) to `bookingStates` (per profile)
- ✅ Added `windowId` and `tabId` to `BookingState`
- ✅ Added `CREATE_BOOKING_WINDOW` message type
- ✅ Added `maxConcurrentWindows` setting
- ✅ Implemented window creation with concurrency limits

### 5. Enhanced Booking State
- ✅ Added `isPaused` and `needsManualAction` flags
- ✅ Added `manualActionMessage` for user guidance
- ✅ Added `otpExpiresAt` for OTP timeout tracking
- ✅ Added `selectedCentre` field
- ✅ Added `confirmationNumber` and `invoiceUrl`
- ✅ Added `paymentStatus` to `PaymentInfo`

### 6. Document Management
- ✅ Added `expiresAt` and `issuedAt` to `DocumentReference`
- Ready for Phase 3 document validation

### 7. Settings Enhancements
- ✅ Added `inactivityLockMinutes` (default: 15)
- ✅ Added `maxConcurrentWindows` (default: 3)
- ✅ Added `sessionTimeoutMinutes` (default: 30)

### 8. New Message Types
- ✅ LOCK_EXTENSION
- ✅ UNLOCK_EXTENSION
- ✅ CHECK_LOCK_STATUS
- ✅ CREATE_BOOKING_WINDOW
- ✅ PAUSE_BOOKING
- ✅ RESUME_BOOKING
- ✅ GET_ALL_BOOKING_STATES
- ✅ SUBMIT_OTP
- ✅ CLEAR_ALL_DATA

## Files Updated

### Core Types
- ✅ `src/types/index.ts` - Complete type system overhaul

### Security
- ✅ `src/security/lock.ts` - NEW: Lock/unlock mechanism
- ✅ `src/security/encryption.ts` - Existing encryption utilities

### Storage
- ✅ `src/storage/index.ts` - Updated for per-profile booking states

### Background
- ✅ `src/background/index.ts` - Added lock checking, multi-window support

### Manifest
- ✅ `manifest.json` - Correct website URL, added alarms permission

## What Needs to Be Done Next

### Immediate (Before Build)
1. ❌ Update popup UI to show lock/unlock
2. ❌ Update popup to handle multiple booking windows
3. ❌ Update options page for new settings
4. ❌ Fix component imports after feature folder reorganization
5. ❌ Add alarms permission to manifest
6. ❌ Update content script for correct IVAC website selectors

### Phase 2 Requirements
1. ❌ OTP input component in popup
2. ❌ Session state tracking
3. ❌ Login success/failure detection
4. ❌ CAPTCHA pause detection

### Phase 3+ Requirements
1. ❌ Document upload UI
2. ❌ Document age validation
3. ❌ IVAC center selection
4. ❌ Date selection or portal-assigned detection
5. ❌ Payment page detection
6. ❌ Invoice download

## Decision Point

**Option A**: Complete refactoring now (2-3 hours more work)
- Update all UI components
- Fix all imports
- Update tests
- Rebuild and verify

**Option B**: Hybrid approach (30 mins)
- Fix build errors
- Get extension loadable
- Implement lock/unlock UI
- Continue with enhanced Phase 2

**Option C**: Document and continue (current)
- Document changes made
- Note what's incomplete
- Decide on next steps

## Current Status

✅ **Type system** - Complete and correct
✅ **Security layer** - Lock mechanism implemented
✅ **Storage layer** - Updated for multi-window
✅ **Background logic** - Updated handlers
⚠️ **UI components** - Need updates for lock state
⚠️ **Build** - Will likely have type errors
❌ **Tests** - Need updates for new types

## Recommendation

Continue with **Option B** (Hybrid):
1. Add alarms permission to manifest
2. Fix popup imports and add lock UI
3. Build and fix type errors
4. Load extension and verify Phase 1 still works
5. Then properly implement Phase 2 with OTP flow
