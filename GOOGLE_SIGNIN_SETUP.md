# Google Sign-In Setup Guide

## Overview
This guide will help you set up Google Sign-In for BuildVault using `expo-auth-session` and Google OAuth 2.0. This approach works with Expo Go and doesn't require native code compilation.

## Prerequisites
- Google Cloud Console account
- BuildVault app configured in Google Cloud Console
- Expo Go app for testing (or development build)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (if not already enabled)

## Step 2: Configure OAuth Consent Screen

1. In the Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace)
3. Fill in the required information:
   - App name: `BuildVault`
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`
5. Add test users (for development) or publish the app (for production)

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Create credentials for each platform:

### iOS Configuration
- Application type: `iOS`
- Bundle ID: `com.edydhm.buildvault`
- Download the configuration file (optional)

### Android Configuration
- Application type: `Android`
- Package name: `com.edydhm.buildvault`
- SHA-1 certificate fingerprint: Get this from your keystore

### Web Configuration (for development)
- Application type: `Web application`
- Authorized redirect URIs: `https://auth.expo.io/@your-expo-username/buildvault`

## Step 4: Update App Configuration

Update the `app.json` file with your Google Client IDs. **Note**: `expo-auth-session` does not need to be added to the plugins array as it doesn't have a config plugin.

```json
{
  "expo": {
    "extra": {
      "googleClientId": {
        "ios": "YOUR_IOS_CLIENT_ID_HERE",
        "android": "YOUR_ANDROID_CLIENT_ID_HERE",
        "web": "YOUR_WEB_CLIENT_ID_HERE"
      }
    }
  }
}
```

## Step 5: Test the Implementation

1. Start the development server: `npm start`
2. Test on iOS simulator or device
3. Test on Android emulator or device
4. Verify that Google Sign-In works correctly

## Troubleshooting

### Common Issues

1. **"Google Client ID not configured" error**
   - Check that the Client IDs are correctly set in `app.json`
   - Ensure the bundle ID matches your Google Cloud Console configuration

2. **"Invalid client" error**
   - Verify the Client ID is correct
   - Check that the bundle ID/package name matches exactly

3. **"Redirect URI mismatch" error**
   - Ensure the redirect URI is correctly configured in Google Cloud Console
   - For Expo development, use the format: `https://auth.expo.io/@your-expo-username/buildvault`

4. **"Access blocked" error**
   - Check OAuth consent screen configuration
   - Ensure test users are added (for development)
   - Verify the app is published (for production)

### Development vs Production

- **Development**: Use test users and keep the app in testing mode
- **Production**: Publish the OAuth consent screen and use production credentials

## Security Notes

- Never commit Client IDs to version control
- Use environment variables for production
- Regularly rotate your credentials
- Monitor usage in Google Cloud Console

## Support

For issues with Google Sign-In implementation:
- Check the [Expo AuthSession documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- Review [Google OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2)
- Check the console logs for detailed error messages
