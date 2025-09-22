# TestFlight Google Sign-In Verification

The production build relies on Supabase OAuth (`supabase.auth.signInWithOAuth`) plus the custom scheme `buildvault://`. Use this checklist before every TestFlight release.

## Why TestFlight Matters

✅ Exercises the full Supabase OAuth flow with real Google accounts  
✅ Confirms the custom scheme redirect works outside Expo Go  
✅ Ensures signing configs and bundle IDs line up prior to App Store submission  

## Build Steps

1. Make sure Supabase env vars are set in EAS project secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
2. Install (or update) EAS CLI: `npm i -g @expo/eas-cli`
3. Login: `eas login`
4. Trigger production build:
   ```bash
   eas build --platform ios --profile production
   ```
5. After the build finishes, submit to TestFlight:
   ```bash
   eas submit --platform ios
   ```

## Google Cloud Console Checklist
- OAuth client (iOS type) must use bundle `com.edydhm.buildvault`
- Authorized redirect URIs:
  - `buildvault://auth/callback`
  - `https://ayppptoommolvkcnksmv.supabase.co/auth/v1/callback`
- Keep the Web client ID for Expo Go / dev fallback

## Supabase Settings Reminder
- Provider → Google includes both redirect URLs above
- "Allow native sign in" enabled
- Project ID: `ayppptoommolvkcnksmv`

## TestFlight QA Script
1. Install latest build from TestFlight
2. Launch BuildVault and tap **Continue with Google**
3. Ensure the in-app browser opens to accounts.google.com
4. Complete auth with a real Google account
5. On redirect back, verify:
   - User lands on Projects screen
   - No error sheets appear
   - Supabase dashboard shows the user under Auth → Users
6. Sign out from Settings → **Sign Out**
7. Repeat sign-in to confirm session refresh works

## Expected Runtime Logs
- Console shows `Google OAuth redirect URI: buildvault://auth/callback`
- Supabase logs a successful `signInWithOAuth` response
- No `redirect_uri_mismatch` errors

## Troubleshooting
- **Redirect URI mismatch** → Update Supabase provider URLs and rebuild
- **Blank screen after auth** → Confirm EAS env vars are present; missing Supabase keys will throw during client init
- **Account chooser stuck** → Add testers on the Google OAuth consent screen until the app is verified

## When Things Break
- Capture device logs (Xcode Devices or `expo run:ios --device`) while reproducing
- Confirm Supabase Auth settings have not been overwritten
- If the Supabase auth URL is missing at runtime, check `lib/auth.ts` logs for `data.url` and update configuration

Once Google Sign-In passes this script, continue with wider TestFlight distribution and App Store review prep.
