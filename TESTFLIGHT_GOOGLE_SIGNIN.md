# TestFlight Google Sign-In Setup Guide

## Why TestFlight is Better for Google Sign-In

✅ **Real OAuth Environment**: TestFlight uses production OAuth flow  
✅ **Native Google Sign-In**: Uses `@react-native-google-signin/google-signin` package  
✅ **No Proxy Issues**: No need for `expo-auth-session` complications  
✅ **Real Device Testing**: Tests on actual iOS devices with proper app signing  

## Current Status

- ✅ Google Sign-In implementation updated for native package
- ✅ `@react-native-google-signin/google-signin` installed
- ✅ App.json configured with plugin
- ✅ Google OAuth credentials configured
- ⏳ Ready for TestFlight build

## Steps to Create TestFlight Build

### 1. Install EAS CLI (if not already installed)
```bash
npm install -g @expo/eas-cli
```

### 2. Login to Expo
```bash
eas login
```

### 3. Configure EAS Build
```bash
eas build:configure
```

### 4. Create iOS Build for TestFlight
```bash
eas build --platform ios --profile preview
```

### 5. Submit to TestFlight
```bash
eas submit --platform ios
```

## Google Cloud Console Configuration

### Required Redirect URIs for TestFlight:
1. **iOS Bundle ID**: `com.yourcompany.buildvault` (from app.json)
2. **iOS URL Scheme**: `com.yourcompany.buildvault` (from app.json)

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Click on your OAuth 2.0 Client ID
4. Add these Authorized Redirect URIs:
   - `com.yourcompany.buildvault:/oauth2redirect`
   - `com.yourcompany.buildvault:/oauth2redirect/`

## Testing on TestFlight

1. **Install TestFlight app** on your iOS device
2. **Install BuildVault** from TestFlight
3. **Test Google Sign-In**:
   - Tap "Continue with Google"
   - Should open native Google Sign-In flow
   - Complete authentication
   - Should return to app successfully logged in

## Expected Behavior

- ✅ Native Google Sign-In popup
- ✅ No "Invalid Redirect URI" errors
- ✅ Proper user authentication
- ✅ User data stored in local database
- ✅ Seamless app navigation

## Troubleshooting

### If Google Sign-In Still Fails:
1. **Check Bundle ID**: Ensure it matches Google Cloud Console
2. **Check URL Scheme**: Must be `com.yourcompany.buildvault`
3. **Check Client ID**: Must be iOS client ID (not web)
4. **Check App Signing**: TestFlight build must be properly signed

### Common Issues:
- **"Invalid Client"**: Wrong client ID or bundle ID mismatch
- **"Redirect URI Mismatch"**: Missing or incorrect redirect URI
- **"App Not Verified"**: Google app verification required for production

## Next Steps After TestFlight Success

1. **Production Apple Sign-In Setup**
2. **Enhanced User Management**
3. **App Store Submission**

---

**Note**: This approach bypasses all the `expo-auth-session` issues we encountered in Expo Go and provides a much more reliable Google Sign-In experience.
