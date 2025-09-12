# Supabase Native App Configuration

## Current Issue
Your Supabase OAuth configuration is set up for **web flows** but not **native app flows**. This is why you're getting localhost redirects.

## Required Supabase Configuration Changes

### 1. Google OAuth Configuration
In your Supabase dashboard → Authentication → Providers → Google:

**Current Configuration:**
- Callback URL: `https://ayppptoommolvkcnksmv.supabase.co/auth/v1/callback`
- Client IDs: Web client ID

**Required Changes:**
1. **Add Native Redirect URL**: You need to add `buildvault://auth/callback` to your Google OAuth configuration
2. **Update Client IDs**: Add your iOS app's client ID (different from web client ID)

### 2. Apple OAuth Configuration
In your Supabase dashboard → Authentication → Providers → Apple:

**Current Configuration:**
- Client IDs: `com.edydhm.buildvault` ✅ (This is correct)
- Callback URL: `https://ayppptoommolvkcnksmv.supabase.co/auth/v1/callback`

**Required Changes:**
1. **Add Native Redirect URL**: Add `buildvault://auth/callback` to your Apple OAuth configuration

## Steps to Fix

### Step 1: Update Supabase Configuration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ayppptoommolvkcnksmv/auth/providers)
2. **Google Provider**:
   - Add `buildvault://auth/callback` to the redirect URLs
   - Add your iOS Google client ID (if different from web)
3. **Apple Provider**:
   - Add `buildvault://auth/callback` to the redirect URLs

### Step 2: Update Google Console (if needed)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find your iOS client ID (or create one)
4. Add `buildvault://auth/callback` to authorized redirect URIs

### Step 3: Update Apple Developer Console (if needed)
1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to Certificates, Identifiers & Profiles → Identifiers
3. Find your Services ID for Sign in with Apple
4. Add `buildvault://auth/callback` to Return URLs

## Alternative: Use Native Sign-In Libraries

If the above doesn't work, we can switch to native sign-in libraries:

### For Google:
```bash
npm install @react-native-google-signin/google-signin
```

### For Apple:
Already using `expo-apple-authentication` ✅

## Test After Configuration

After making these changes:
1. Build a new TestFlight version
2. Test both Apple and Google sign-in
3. Check logs for proper redirect handling

## Current Status
- ✅ Apple Sign-In: Native implementation ready
- ❌ Google Sign-In: Needs Supabase configuration update
- ❌ OAuth Redirects: Need native redirect URLs configured
