# IVAC Appointment Assistant

A secure Chrome extension to assist with IVAC Bangladesh visa appointment booking. This extension helps manage applicant profiles, securely store credentials, and streamline the booking workflow while respecting all website rules and security measures.

## Features

### Phase 1 (Current)
- ✅ Secure profile management with encrypted credential storage
- ✅ Dashboard UI for managing multiple applicant profiles
- ✅ Login autofill assistance (user confirms submission)
- ✅ Settings page with privacy controls
- ✅ Local-only data storage (no external servers)

### Upcoming Phases
- Phase 2: User-controlled OTP workflow
- Phase 3: Document selection and upload assistance
- Phase 4: Booking workflow tracking and date selection
- Phase 5: Payment verification
- Phase 6: Multi-window orchestration and error recovery

## Installation

### Development Installation

1. **Clone or download the project**
   ```bash
   cd d:\ivac-extention
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome/Edge**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

5. **Verify installation**
   - You should see the IVAC Assistant icon in your extensions toolbar
   - Click it to open the popup dashboard

### Production Installation

For production use, the extension would be packaged and distributed through the Chrome Web Store.

## Usage

### Creating a Profile

1. Click the extension icon in your browser toolbar
2. Click "+ New Profile"
3. Fill in your applicant information:
   - Personal details (name, email, phone)
   - Passport information
   - Visa type and center preference
   - (Optional) IVAC login credentials for autofill

4. Click "Save Profile"

### Using Login Autofill

1. Select your active profile in the popup
2. Navigate to the IVAC login page: https://payment.ivacbd.com/
3. Click "Auto-fill Login" in the extension popup
4. **Review the filled credentials**
5. **Manually click the login button** (extension does not auto-submit)

### Managing Settings

1. Click the extension icon
2. Click the settings (gear) icon
3. Configure:
   - Auto-fill preferences
   - Notification settings
   - OTP confirmation requirements
   - Theme and logging preferences

## Security & Privacy

### Data Storage
- All data is stored **locally** on your device using Chrome's storage API
- No data is transmitted to external servers
- No analytics or tracking

### Credential Encryption
- Login credentials are encrypted using **AES-256-GCM**
- Encryption keys are derived using **PBKDF2** with 100,000 iterations
- Credentials never leave your device

### User Control
- OTP must be entered manually by the user
- Extension highlights fields but user confirms all submissions
- User can review all autofilled data before proceeding
- All actions require explicit user interaction

## Development

### Project Structure

```
ivac-extention/
├── src/
│   ├── background/         # Service worker
│   ├── content/            # Content scripts for IVAC website
│   ├── popup/              # Quick access popup UI
│   ├── options/            # Full settings page
│   ├── components/         # Shared React components
│   ├── security/           # Encryption utilities
│   ├── storage/            # Storage layer
│   └── types/              # TypeScript type definitions
├── public/
│   └── icons/              # Extension icons
├── tests/                  # Test files
├── manifest.json           # Extension manifest (Manifest V3)
└── README.md
```

### Available Scripts

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Run tests
npm test
```

### Technology Stack

- **TypeScript** - Type-safe development
- **React** - UI components
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Web Crypto API** - Encryption
- **Chrome Extension Manifest V3** - Extension framework
- **Vitest** - Testing framework

## Limitations

### What This Extension Does NOT Do

1. **Cannot bypass security measures**
   - Will not bypass CAPTCHA
   - Will not bypass anti-bot protections
   - Will not circumvent rate limits
   - Will not automate beyond user assistance

2. **Cannot guarantee availability**
   - Does not create appointments that don't exist
   - Does not provide priority access
   - Respects all queue systems

3. **User interaction required**
   - User must manually enter OTP
   - User must click submit buttons
   - User must review all autofilled data
   - User must complete payment externally

4. **Technical limitations**
   - Works only on IVAC Bangladesh website
   - Requires manual updates if website structure changes
   - Cannot interact with external payment gateways beyond handoff

## Known Issues

- Icons are placeholder images (replace with actual branded icons)
- Encryption key management is simplified for demo (enhance for production)
- Content script selectors may need adjustment based on actual IVAC website structure
- No automatic update mechanism yet

## Troubleshooting

### Extension not loading
- Ensure you built the project: `npm run build`
- Check that you loaded the `dist` folder, not the root folder
- Look for errors in `chrome://extensions/` with developer mode enabled

### Autofill not working
- Verify you're on the correct IVAC website URL
- Ensure you have an active profile selected
- Check that credentials are saved in the profile
- Open the browser console (F12) to check for errors

### Profile not saving
- Ensure all required fields are filled
- Check browser console for errors
- Verify Chrome has storage permissions

### Type checking fails
- Run `npm install` to ensure all dependencies are installed
- Check that `@types/chrome` is in devDependencies

## Compliance

### Terms of Service
This extension:
- Does not violate IVAC website terms of service
- Does not perform automated actions without user confirmation
- Respects all rate limits and access controls
- Does not scrape or store IVAC proprietary data

### Ethical Use
Users must:
- Use the extension only for legitimate visa applications
- Not attempt to bypass queue systems
- Not share or sell profiles or bookings
- Comply with all IVAC policies and procedures

## Roadmap

### Phase 2: OTP Flow (Next)
- Detect OTP input fields
- Show OTP notification prompt
- Guide user through verification
- Track login state

### Phase 3: Document Management
- Document upload interface
- File format validation
- Document queue management
- Progress tracking

### Phase 4: Booking Workflow
- Date availability parser
- Calendar integration
- Multi-step progress tracking
- Retry logic

### Phase 5: Payment Integration
- Payment page detection
- Invoice extraction
- Verification prompts
- Transaction logging

### Phase 6: Polish & Testing
- Multi-window management
- Comprehensive error recovery
- Full test coverage
- Security audit
- Performance optimization

## Support

For issues or questions:
1. Check this README's troubleshooting section
2. Review the console for error messages
3. Verify you're using the latest build
4. Check that the IVAC website hasn't changed structure

## License

ISC License - See LICENSE file for details

## Version History

### 1.0.0 (Phase 1 - Current)
- Initial release
- Profile management
- Secure credential storage
- Login autofill assistance
- Settings UI
- Basic content script framework

---

**Important**: This is an assistive tool, not an automation bot. All critical actions require user review and confirmation. The extension respects IVAC website policies and does not bypass any security measures.
