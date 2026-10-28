# Installation Instructions

## Chrome/Edge Installation (Development Mode)

### Prerequisites
- Google Chrome or Microsoft Edge browser (version 88+)
- Node.js (version 18+) and npm installed

### Step 1: Build the Extension

1. Open a terminal/PowerShell window
2. Navigate to the project directory:
   ```powershell
   cd d:\ivac-extention
   ```

3. Install dependencies (first time only):
   ```powershell
   npm install
   ```

4. Build the extension:
   ```powershell
   npm run build
   ```

   This will:
   - Compile TypeScript to JavaScript
   - Bundle React components
   - Copy manifest and assets to `dist/` folder
   - Run type checking

5. Verify the build completed successfully:
   ```powershell
   ls dist
   ```

   You should see:
   - `manifest.json`
   - `background.js`
   - `content.js`
   - `popup.html` and `options.html`
   - `icons/` folder
   - `assets/` folder with bundled JavaScript

### Step 2: Load in Chrome

1. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Look for "Developer mode" toggle in the top-right corner
   - Turn it ON

3. **Load the Extension**
   - Click "Load unpacked" button
   - Browse to `d:\ivac-extention\dist` folder
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "IVAC Appointment Assistant" in your extensions list
   - The extension icon should appear in your browser toolbar
   - Status should show "On" (green toggle)

### Step 3: Load in Microsoft Edge

1. **Open Edge Extensions Page**
   - Open Microsoft Edge
   - Navigate to `edge://extensions/`
   - Or: Menu (…) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Look for "Developer mode" toggle in the bottom-left corner
   - Turn it ON

3. **Load the Extension**
   - Click "Load unpacked"
   - Browse to `d:\ivac-extention\dist` folder
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "IVAC Appointment Assistant" in your extensions list
   - The extension icon should appear in your browser toolbar

## First-Time Setup

After installation:

1. **Click the Extension Icon**
   - Look for the IVAC Assistant icon in your browser toolbar
   - If you don't see it, click the extensions puzzle icon (🧩) and pin IVAC Assistant

2. **Create Your First Profile**
   - Click "+ New Profile" in the popup
   - Fill in your applicant information
   - Optionally add IVAC login credentials
   - Click "Save Profile"

3. **Verify Profile is Active**
   - The profile should show an "Active" badge
   - You're now ready to use the extension

## Testing the Extension

### Test 1: Popup Interface

1. Click the extension icon
2. Verify you see:
   - Extension header with "IVAC Assistant" title
   - Your profile list
   - "Auto-fill Login" button (when profile is selected)
   - Settings gear icon

### Test 2: Options Page

1. Right-click the extension icon → Options
2. Or click the settings gear in the popup
3. Verify you see:
   - Profiles tab with full profile management
   - Settings tab with toggles and preferences
   - Help tab with documentation

### Test 3: Content Script

1. Navigate to `https://payment.ivacbd.com/` (or any subdomain)
2. The extension should detect the page
3. Open browser console (F12)
4. Look for: "IVAC Assistant content script loaded"

**Note**: If the IVAC website is not accessible, content script integration cannot be fully tested. The extension will still work for profile management.

## Troubleshooting

### Extension Won't Load

**Problem**: "Failed to load extension" error

**Solutions**:
1. Ensure you selected the `dist/` folder, not the root project folder
2. Verify `manifest.json` exists in the dist folder
3. Check that build completed without errors: `npm run build`
4. Look for specific error message in red on the extensions page

### Build Failures

**Problem**: `npm run build` fails with errors

**Solutions**:
1. Ensure Node.js version 18+ is installed: `node --version`
2. Delete `node_modules` and reinstall:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   npm install
   ```
3. Clear npm cache:
   ```powershell
   npm cache clean --force
   npm install
   ```

### Extension Icon Not Visible

**Problem**: Can't see the extension icon in toolbar

**Solutions**:
1. Click the extensions puzzle icon (🧩) in Chrome/Edge toolbar
2. Find "IVAC Appointment Assistant"
3. Click the pin icon to pin it to toolbar
4. Icon should now be visible

### Type Checking Errors

**Problem**: `npm run typecheck` shows errors

**Solution**:
```powershell
npm run typecheck
```

Review errors and fix TypeScript issues before building.

### Tests Failing

**Problem**: `npm test` shows failures

**Solution**:
```powershell
npm test
```

Check test output for specific failures. All 9 tests should pass for Phase 1.

### Extension Crashes or Not Working

**Problem**: Extension installed but not functioning

**Solutions**:
1. Check for errors in extension details page:
   - Go to `chrome://extensions/`
   - Click "Details" on IVAC Assistant
   - Look for errors under "Inspect views"

2. Check background service worker:
   - Click "Inspect views: service worker" (background page)
   - Look for errors in console

3. Check content script:
   - Visit an IVAC website
   - Open DevTools (F12)
   - Look for console errors

4. Reload extension:
   - Go to `chrome://extensions/`
   - Click refresh icon (🔄) on IVAC Assistant

### Profile Not Saving

**Problem**: Profile form data doesn't save

**Solutions**:
1. Check that all required fields (marked with *) are filled
2. Open browser console for error messages
3. Verify storage permissions in manifest
4. Try reloading the extension

## Updating the Extension

When you make changes to the code:

1. **Rebuild**:
   ```powershell
   npm run build
   ```

2. **Reload Extension**:
   - Go to `chrome://extensions/`
   - Click refresh icon (🔄) on IVAC Assistant
   - Or: Remove and re-add the extension

3. **Hard Refresh Extension Pages**:
   - If popup/options look wrong, close them completely
   - Reopen after reloading extension

## Development Workflow

For active development:

1. **Watch Mode** (auto-rebuild on changes):
   ```powershell
   npm run dev
   ```

2. **In a separate terminal**, reload extension after each build

3. **For React component changes**:
   - Changes to popup/options require extension reload
   - May need to close and reopen popup/options

4. **For content script changes**:
   - Reload extension
   - Reload the web page you're testing on

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/` or `edge://extensions/`
2. Find "IVAC Appointment Assistant"
3. Click "Remove"
4. Confirm removal

**Note**: This does NOT delete your local files or built extension in the `dist/` folder.

## Security Note

When installed in developer mode:
- Chrome will show "Developer mode extensions may harm your computer" warning
- This is normal for unpacked extensions
- The extension only accesses IVAC websites (see manifest permissions)
- All data is stored locally on your device

## Next Steps

After successful installation:
1. Read the [README.md](README.md) for feature documentation
2. Review [SAMPLE_DATA.md](SAMPLE_DATA.md) for test profiles
3. Configure your first profile
4. Test on the IVAC website

---

**Need Help?**
- Check console for errors (F12)
- Review manifest.json permissions
- Verify build output in `dist/` folder
- Ensure you're using Chrome/Edge version 88+
