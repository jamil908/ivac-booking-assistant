# Sample Configuration Data

This file contains sample applicant profiles for testing the extension. **DO NOT use real personal data during development.**

## Sample Profile 1: Tourist Visa

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+880-1234-567890",
  "passportNumber": "AB1234567",
  "nationality": "Bangladesh",
  "dateOfBirth": "1990-05-15",
  "visaType": "tourist",
  "center": "dhaka",
  "ivacUsername": "john.doe@example.com",
  "ivacPassword": "TestPassword123!",
  "preferredDates": ["2027-01-15", "2027-01-20", "2027-01-25"]
}
```

## Sample Profile 2: Business Visa

```json
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "phone": "+880-9876-543210",
  "passportNumber": "CD9876543",
  "nationality": "Bangladesh",
  "dateOfBirth": "1985-08-22",
  "visaType": "business",
  "center": "chittagong",
  "ivacUsername": "jane.smith@example.com",
  "ivacPassword": "SecurePass456!",
  "preferredDates": ["2027-02-01", "2027-02-05", "2027-02-10"]
}
```

## Sample Profile 3: Medical Visa

```json
{
  "name": "Ahmed Rahman",
  "email": "ahmed.rahman@example.com",
  "phone": "+880-1111-222333",
  "passportNumber": "EF5555555",
  "nationality": "Bangladesh",
  "dateOfBirth": "1975-12-10",
  "visaType": "medical",
  "center": "dhaka",
  "ivacUsername": "ahmed.rahman@example.com",
  "ivacPassword": "Medical789!",
  "preferredDates": ["2027-01-10", "2027-01-12", "2027-01-15"]
}
```

## Sample Profile 4: Student Visa

```json
{
  "name": "Fatima Khan",
  "email": "fatima.khan@example.com",
  "phone": "+880-4444-555666",
  "passportNumber": "GH2222222",
  "nationality": "Bangladesh",
  "dateOfBirth": "2000-03-25",
  "visaType": "student",
  "center": "sylhet",
  "ivacUsername": "fatima.khan@example.com",
  "ivacPassword": "Student2027!",
  "preferredDates": ["2027-03-01", "2027-03-05", "2027-03-10"]
}
```

## How to Use Sample Data

### Testing in Extension

1. Open the extension popup or options page
2. Click "New Profile"
3. Copy the fields from a sample profile above
4. Save the profile

### Importing via Console (Advanced)

You can import test profiles directly via browser console:

```javascript
// Open extension popup or options page
// Open browser console (F12)
// Run:

const sampleProfile = {
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "+880-1234-567890",
  passportNumber: "AB1234567",
  nationality: "Bangladesh",
  dateOfBirth: "1990-05-15",
  visaType: "tourist",
  center: "dhaka",
  ivacUsername: "john.doe@example.com",
  ivacPassword: "TestPassword123!",
  preferredDates: ["2027-01-15", "2027-01-20", "2027-01-25"]
};

chrome.runtime.sendMessage(
  { type: 'SAVE_PROFILE', payload: sampleProfile },
  (response) => console.log('Profile saved:', response)
);
```

## Document References (Placeholder)

For testing document upload features (Phase 3), you'll need:

- **Passport Copy**: First page with photo and details (JPEG/PNG, max 2MB)
- **Passport Photo**: 2x2 inches, white background (JPEG, max 100KB)
- **Invitation Letter**: PDF or DOCX (max 5MB)
- **Hotel Booking**: Confirmation PDF (max 2MB)
- **Flight Ticket**: Itinerary or booking confirmation (PDF, max 2MB)
- **Bank Statement**: Last 3 months (PDF, max 5MB)

## Security Note

⚠️ **IMPORTANT**: 
- Never use real passport numbers, credentials, or personal information in development
- These sample profiles use obviously fake data
- Clear all test data before deploying to production
- Do not commit files containing real user data to version control

## Clearing Test Data

To clear all test profiles and start fresh:

1. Open extension options page
2. Open browser console (F12)
3. Run: 
```javascript
chrome.storage.local.clear(() => {
  console.log('All data cleared');
  location.reload();
});
```

Or use the extension's built-in reset (to be implemented):
- Settings → Advanced → Reset All Data
