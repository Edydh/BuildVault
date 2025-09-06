# Quick Google Sign-In Setup

## Current Status
✅ **Apple Sign-In**: Working perfectly  
⚠️ **Google Sign-In**: Needs OAuth credentials setup

## The Issue
The Google Sign-In is showing a "400. That's an error. The server cannot process the request because it is malformed" error because we haven't configured the Google OAuth credentials yet.

## Quick Fix (5 minutes)

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client IDs"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `https://auth.expo.io/@your-expo-username/buildvault`
   - `exp://192.168.2.161:8081` (your current Expo URL)
7. Copy the **Client ID**

### Step 2: Update app.json

Replace the placeholder values in `app.json`:

```json
{
  "expo": {
    "extra": {
      "googleClientId": {
        "ios": "YOUR_ACTUAL_CLIENT_ID_HERE",
        "android": "YOUR_ACTUAL_CLIENT_ID_HERE", 
        "web": "YOUR_ACTUAL_CLIENT_ID_HERE"
      }
    }
  }
}
```

### Step 3: Test

1. Restart the Expo server: `npm start`
2. Try Google Sign-In again
3. It should now work properly!

## Alternative: Use Apple Sign-In Only

If you prefer to keep it simple for now, Apple Sign-In is already working perfectly. You can:

1. Keep the current setup
2. Remove the Google Sign-In button temporarily
3. Focus on other features

## Why This Happened

The `expo-auth-session` package requires valid OAuth credentials to work. Without them, Google's servers reject the malformed request with a 400 error.

## Current Working Features

✅ **Apple Sign-In**: Fully functional  
✅ **User Authentication**: Working  
✅ **Project Management**: Working  
✅ **Media Capture**: Working  
✅ **All Core Features**: Working  

The app is fully functional with Apple Sign-In - Google Sign-In is just an additional option that needs OAuth setup.
