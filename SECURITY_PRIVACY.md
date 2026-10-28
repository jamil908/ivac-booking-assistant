# Security & Privacy Documentation

## Overview

The IVAC Appointment Assistant is designed with security and privacy as core principles. This document explains our security measures, privacy guarantees, and compliance considerations.

## Data Storage

### Local-Only Storage

**All data is stored locally on your device.**

- **Storage API**: Chrome's `chrome.storage.local`
- **Location**: Browser's internal storage (not accessible as regular files)
- **No External Servers**: No data is transmitted to any external server
- **No Cloud Sync**: Data does not sync across devices
- **No Analytics**: No usage tracking or telemetry

### What Data is Stored

1. **Applicant Profiles**
   - Personal information (name, email, phone, date of birth)
   - Passport details (number, nationality)
   - Visa preferences (type, center, preferred dates)
   - Login credentials (encrypted - see below)

2. **Documents** (Phase 3)
   - Files stored as base64-encoded data URLs
   - Only stored when user explicitly uploads them
   - Can be deleted at any time

3. **Booking State** (Phases 2-5)
   - Current workflow step
   - Session information
   - No sensitive payment information stored

4. **Settings**
   - User preferences and configurations
   - No personal or sensitive data

## Encryption

### Credential Encryption

Login credentials (username/password) are encrypted before storage using industry-standard cryptography:

**Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits
- **Authenticated Encryption**: Provides both confidentiality and integrity
- **IV**: Unique 96-bit initialization vector per encryption operation

**Key Derivation**: PBKDF2 (Password-Based Key Derivation Function 2)
- **Hash Function**: SHA-256
- **Iterations**: 100,000 (recommended by OWASP 2023)
- **Salt**: Unique 128-bit random salt per password

### Implementation

```typescript
// Simplified overview - see src/security/encryption.ts for full code

// 1. Derive encryption key from master password
const { key } = await deriveKeyFromPassword(userPassword);

// 2. Encrypt sensitive data
const { encrypted, iv } = await encryptData(sensitiveData, key);

// 3. Store encrypted data and IV
store(`enc:${encrypted}:${iv}`);
```

### Security Properties

- **Forward Secrecy**: Each encryption uses a unique IV
- **Key Stretching**: PBKDF2 makes brute-force attacks computationally expensive
- **Authenticated**: GCM mode detects tampering attempts
- **No Key Storage**: Encryption keys are never stored, only derived when needed

### Limitations

**Current Implementation** (Phase 1):
- Master password mechanism is simplified for demonstration
- Production deployment should implement:
  - User-controlled master password
  - Password strength requirements
  - Key rotation policies
  - Secure key derivation context

## Permissions

### Chrome Extension Permissions

The extension requests these permissions in `manifest.json`:

```json
{
  "permissions": [
    "storage",       // Store profiles and settings locally
    "tabs",          // Detect IVAC website tabs
    "scripting",     // Inject content scripts
    "activeTab",     // Access current tab for autofill
    "notifications"  // Show OTP and status notifications
  ],
  "host_permissions": [
    "https://payment.ivacbd.com/*",
    "https://*.ivacbd.com/*"
  ]
}
```

### What Each Permission Does

1. **`storage`**
   - Required: Store profiles, settings, and encrypted credentials locally
   - Scope: Local device only
   - No network access

2. **`tabs`**
   - Required: Detect when user navigates to IVAC website
   - Scope: Read tab URL only (not content)
   - No data collection

3. **`scripting`**
   - Required: Inject content script to assist with forms
   - Scope: Only on IVAC domains
   - User-initiated actions only

4. **`activeTab`**
   - Required: Auto-fill login form when user clicks "Auto-fill"
   - Scope: Current tab only, user-triggered
   - No background access

5. **`notifications`**
   - Required: Alert user for OTP and important events
   - Scope: Local notifications only
   - Can be disabled in settings

### Host Permissions

**Restricted to IVAC Domains**:
- `https://payment.ivacbd.com/*`
- `https://*.ivacbd.com/*`

The extension:
- **Cannot** access any other websites
- **Cannot** run on other domains
- **Cannot** modify non-IVAC pages

## Privacy Guarantees

### No Data Collection

The extension does NOT:
- ❌ Collect usage statistics
- ❌ Track user behavior
- ❌ Send analytics
- ❌ Report errors to external services
- ❌ Share data with third parties
- ❌ Use cookies or tracking pixels

### No Network Requests

The extension does NOT:
- ❌ Make HTTP requests to external servers
- ❌ Connect to APIs beyond IVAC website
- ❌ Upload any data
- ❌ Download remote code
- ❌ Phone home

**Exception**: The extension naturally interacts with the IVAC website when you use it, but this is identical to normal browser usage.

### Data Deletion

Users have full control:
- ✅ Delete individual profiles
- ✅ Delete documents
- ✅ Clear all data (Settings → Advanced)
- ✅ Uninstall extension (removes all data)

### No Cross-Device Sync

- Data does NOT sync to Chrome account
- Data does NOT sync across devices
- Each browser installation is independent
- Reinstalling extension loses all data

## User Control

### Manual Actions Required

The extension NEVER:
- ❌ Automatically submits forms
- ❌ Clicks buttons without permission
- ❌ Enters OTP automatically
- ❌ Completes transactions unattended
- ❌ Bypasses security measures

**All critical actions require explicit user confirmation.**

### User-Controlled OTP

**Phase 2 Implementation**:
1. Extension detects OTP field
2. Notifies user via notification
3. **User manually enters OTP**
4. User manually clicks submit
5. Extension does NOT touch OTP input

### Credential Autofill

**Current Behavior**:
1. User clicks "Auto-fill Login" in extension popup
2. Extension fills username and password fields
3. Fields are **highlighted for review**
4. **User must manually click login button**
5. Extension does NOT auto-submit

## Compliance

### GDPR Considerations

**Data Controller**: The user (not the extension developer)
- User has complete control over their data
- Data is stored locally, not processed by third parties
- No data sharing or transfers

**User Rights**:
- ✅ Right to access: User can view all stored data
- ✅ Right to erasure: User can delete data anytime
- ✅ Right to data portability: User can export/backup
- ✅ Right to object: User can disable any feature

### Terms of Service Compliance

The extension:
- ✅ Respects IVAC website terms of service
- ✅ Does not bypass security measures
- ✅ Does not circumvent rate limits
- ✅ Does not automate without user control
- ✅ Does not scrape proprietary data

### Ethical Use Policy

**Prohibited Uses**:
- ❌ Automated booking without human oversight
- ❌ Bypassing queues or access controls
- ❌ Sharing or selling booking slots
- ❌ Multiple simultaneous bookings
- ❌ Any use that violates IVAC policies

**Permitted Uses**:
- ✅ Storing personal applicant information
- ✅ Assisting with form completion
- ✅ Tracking booking workflow
- ✅ Managing multiple applicant profiles
- ✅ Legitimate personal use

## Threat Model

### What We Protect Against

1. **Data Theft via Extension**
   - Mitigation: Encryption, no external transmission
   - Risk: Low

2. **Malicious Extension Updates**
   - Mitigation: Developer mode only (Phase 1), manual updates
   - Risk: Low (no auto-updates from store yet)

3. **Local System Compromise**
   - Mitigation: Encryption at rest
   - Risk: Medium (if device is compromised, encryption helps but is not absolute)

4. **Browser Vulnerabilities**
   - Mitigation: Use latest Chrome/Edge versions
   - Risk: Low (rely on browser security model)

### What We Don't Protect Against

1. **Physical Device Access**
   - If attacker has physical access to unlocked device
   - Mitigation: Use device-level security (passwords, encryption)

2. **Keyloggers/Screen Capture**
   - If malware is running on the system
   - Mitigation: Use antivirus, keep system updated

3. **Social Engineering**
   - If user is tricked into revealing credentials
   - Mitigation: User awareness, never share credentials

4. **IVAC Website Compromise**
   - If IVAC website itself is compromised
   - Mitigation: None (out of scope for extension)

## Security Best Practices

### For Users

1. **Keep Browser Updated**
   - Use latest Chrome/Edge version
   - Enable automatic browser updates

2. **Use Strong Passwords**
   - For IVAC account
   - For device/system login

3. **Enable Device Security**
   - Use full disk encryption (BitLocker on Windows)
   - Lock screen when away
   - Use strong device password

4. **Verify Extension Source**
   - Only install from trusted sources
   - Review code if technically capable
   - Check manifest permissions

5. **Regular Data Review**
   - Periodically review stored profiles
   - Delete unused profiles
   - Clear old booking data

### For Developers

1. **Code Review**
   - Review all code changes for security implications
   - Use static analysis tools
   - Follow secure coding practices

2. **Dependency Management**
   - Keep dependencies updated
   - Monitor for security advisories
   - Use lock files (package-lock.json)

3. **Testing**
   - Write security tests
   - Test encryption/decryption
   - Test permission boundaries

4. **Incident Response**
   - Have a plan for security issues
   - Provide clear contact methods
   - Document known vulnerabilities

## Known Limitations

### Phase 1 Limitations

1. **Simplified Key Management**
   - Current: Basic password-based encryption
   - Future: User-controlled master password with strength requirements

2. **No Key Rotation**
   - Current: Keys derived but not rotated
   - Future: Implement periodic key rotation

3. **No Backup/Export**
   - Current: No official backup mechanism
   - Future: Encrypted export functionality

4. **No Multi-Factor Auth**
   - Current: Password-only encryption
   - Future: Consider hardware key support

### Security Roadmap

**Phase 2**:
- Enhanced master password UI
- Password strength meter
- Secure password reset flow

**Phase 3**:
- Encrypted document storage
- File size and type validation
- Malware scanning integration

**Phase 4**:
- Session security enhancements
- Secure state management
- Anti-tampering measures

**Phase 5**:
- Payment data security
- Transaction verification
- Audit logging

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. **Do NOT** disclose publicly until fixed
3. **Do** contact the development team privately
4. **Do** provide detailed reproduction steps

**Response Time**:
- Acknowledgment: 48 hours
- Initial assessment: 1 week
- Fix deployment: Depends on severity

## Audit & Verification

### Code Transparency

- Full source code available for review
- All security-critical code documented
- No obfuscation or minification of security logic

### Testing

```bash
# Run security-focused tests
npm test

# Review encryption implementation
cat src/security/encryption.ts

# Check storage layer
cat src/storage/index.ts

# Verify manifest permissions
cat manifest.json
```

### Third-Party Dependencies

Review `package.json` for dependencies:
- React, React-DOM: UI framework
- Vite: Build tool
- Tailwind CSS: Styling
- TypeScript: Type safety
- Vitest: Testing

**No third-party security libraries** are used; encryption relies on Web Crypto API (native browser implementation).

## Conclusion

Security and privacy are fundamental to the IVAC Assistant extension:
- **Local-first** architecture
- **Encrypted credentials** using industry standards
- **No data collection** or external transmission
- **User control** over all actions
- **Transparent** implementation

Users maintain complete control and ownership of their data at all times.

---

**Last Updated**: Phase 1 Release (v1.0.0)  
**Next Review**: Phase 2 Implementation
