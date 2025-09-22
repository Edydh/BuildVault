# Supabase Native App Configuration

The production build uses Supabase OAuth for both Apple and Google sign-in. This doc tracks the required configuration so native builds (EAS / TestFlight) keep working.

## Redirect Scheme
- Expo config defines the custom scheme `buildvault://` (`app.config.ts`)  
- Auth flows expect the redirect `buildvault://auth/callback`
- Keep `https://ayppptoommolvkcnksmv.supabase.co/auth/v1/callback` in place as the secondary web fallback

## Supabase Provider Settings
Open the Supabase dashboard → Authentication → Providers.

### Google
- Add both redirect URLs:
  - `buildvault://auth/callback`
  - `https://ayppptoommolvkcnksmv.supabase.co/auth/v1/callback`
- Client IDs:
  - Web client ID (for Expo Go / web fallback)
  - iOS client ID that matches bundle `com.edydhm.buildvault`
  - (Optional) Android client ID if/when we ship Android

### Apple
- Services ID: `com.edydhm.buildvault`
- Team ID: use the App Store Connect team that signs the build
- Redirect URLs:
  - `buildvault://auth/callback`
  - `https://ayppptoommolvkcnksmv.supabase.co/auth/v1/callback`
- Enable "Sign in with Apple" for the bundle identifier

## Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. API & Services → Credentials → OAuth Client IDs
3. Ensure the iOS client ID has the bundle `com.edydhm.buildvault`
4. Add the native redirect `com.edydhm.buildvault:/oauth2redirect` in case we enable the Google SDK path later
5. Keep the web client ID for `expo-auth-session` fallback

## Apple Developer Console
1. Visit [Apple Developer](https://developer.apple.com/account/)
2. Certificates, Identifiers & Profiles → Identifiers → Services IDs
3. Select `com.edydhm.buildvault`
4. Add the return URL `buildvault://auth/callback`
5. Confirm the primary app ID (bundle) is linked to the Services ID

## Environment Variables
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected through `app.config.ts` (`extra.supabase*`).
- Locally, Expo CLI reads them from `.env`; in EAS you must set matching project secrets.
- Missing values will throw at runtime (`lib/supabase.ts`).

## Testing Checklist
1. Run `npx expo-doctor` (should pass) 
2. Build with `eas build --platform ios --profile production`
3. Install via TestFlight, verify:
   - Apple Sign-In completes and user appears in Supabase Auth → Users
   - Google Sign-In opens browser modal and returns to the app without redirect errors
4. Check device logs for `supabase.auth` errors and update providers if needed

## Troubleshooting
- **Redirect URI mismatch** → double-check Supabase provider URLs and `scheme` in `app.config.ts`
- **Invalid client / audience** → wrong Google client ID (ensure iOS type)
- **User stuck on loading after OAuth** → confirm EAS build has Supabase env secrets available
- **Expo Go tests** → development builds still use local SQLite-only auth fallback
