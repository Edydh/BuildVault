# BuildVault — Construction Project Media Organizer (Expo)

Small-but-mighty, field-ready app for construction professionals to capture, organize, and share project media. Built with Expo SDK 54, React Native 0.81, Expo Router, and a custom "Liquid Glass" design system.

## Highlights
- Projects: create, view, delete, and share
- Per-project media: photos, videos, and documents
- Capture via device camera + document picker
- Notes & timestamps; multi-select share
- Apple / Google sign-in backed by Supabase Auth
- Offline-first: files stored locally; metadata in SQLite
- Liquid Glass UI

## Tech Stack
- Runtime: Expo SDK 54 (React Native 0.81)
- Routing: Expo Router 6
- Styling: Custom Liquid Glass component library powered by `expo-blur`, `expo-linear-gradient`, and Reanimated
- Media: `expo-camera`, `expo-video`, `expo-video-thumbnails`, `expo-document-picker`
- Storage: `expo-file-system`, `expo-sqlite`
- Auth: `expo-apple-authentication`, Supabase OAuth (Apple + Google)
- Share: `expo-sharing`
- Icons/Haptics: `@expo/vector-icons`, `expo-haptics`

## Quick Start

1) Install prerequisites
- Node 18+ (20 recommended)
- Xcode (iOS) / Android Studio (Android)
- EAS CLI: `npm i -g @expo/eas-cli`

2) Install dependencies

```bash
npm i
```

3) Start the app

```bash
npm run start
# press "i" for iOS simulator, "a" for Android
```

4) Authenticate locally (optional)
- Copy `.env.example` → `.env`
- Populate `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Expo CLI will load these automatically when you run `npm run start`
```

## Configuration

- `app.config.ts` defines platform permissions, bundle IDs, plugin config, and exposes Supabase env values.
- `babel.config.js` includes `expo-router/babel` and Reanimated.
- Supabase env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) must be present locally and in EAS project secrets.
- TypeScript is in strict mode (see `tsconfig.json`).
- Basic ESLint + Prettier configs included.

## Project Structure

```
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx                 # Projects dashboard, search, Liquid Glass UI
    settings.tsx              # Account, data management, glass theme controls
  auth.tsx                    # Apple / Google authentication screen
  project/
    [id]/index.tsx            # Project overview with tabbed media sections
    [id]/gallery.tsx          # Liquid Glass gallery with zoom + notes
    [id]/capture.tsx          # Camera + document picker
    [id]/media/[mediaId].tsx  # Detailed media viewer with sharing + notes
components/
  glass/                      # Liquid Glass component system (cards, buttons, modals, etc.)
  EditProjectModal.tsx
  LazyImage.tsx
  ProjectCard.tsx
lib/
  AuthContext.tsx             # Auth provider + guarded routes
  auth.ts                     # Apple / Google sign-in with Supabase sync
  db.ts                       # SQLite helper + migrations
  files.ts                    # Safe filesystem helpers
  supabase.ts                 # Supabase client bootstrap
  imageOptimization.ts        # Thumbnail + compression pipeline
assets/
  icon.png, splash-icon.png
```

## Data Model & Storage

- SQLite tables
  - `projects`: id TEXT PK, name TEXT, client TEXT?, location TEXT?, created_at INTEGER
  - `media`: id TEXT PK, project_id TEXT FK, type TEXT ('photo'|'video'|'doc'), uri TEXT, thumb_uri TEXT?, note TEXT?, created_at INTEGER

- Filesystem
  - App sandbox under `FileSystem.documentDirectory`: `projects/<projectId>/<filename>`
  - Videos: thumbnail via `expo-video-thumbnails`
  - Documents: copied into the project directory
  - Deleting a project removes its folder and related DB rows

## Permissions

### iOS
- NSCameraUsageDescription
- NSMicrophoneUsageDescription
- NSPhotoLibraryUsageDescription
- NSPhotoLibraryAddUsageDescription

### Android
- CAMERA, RECORD_AUDIO (for video)
- READ_MEDIA_IMAGES, READ_MEDIA_VIDEO (Android 13+)

Expo handles legacy storage fallbacks where needed.

## Primary Flows

- Projects list with search, create modal, long-press delete (confirm)
- Project overview with tabs (All, Photos, Videos, Docs), multi-select, Share
- Capture screen with photo/video toggle, flip, flash, Add note, Pick Document
- Media detail (preview image/video), edit note, Share, Delete

## Notes

- Offline-first local storage: projects + media live in SQLite and the device filesystem.
- Authentication gracefully falls back to local dev accounts when running in Expo Go.
- Multi-share and exports run sequentially to keep OS share sheets responsive.

## Development Tips

- Tailwind classes are used sparingly to keep UI readable.
- Keep components small; most data access goes through `lib/db.ts`.
- If you add new screens, ensure they live under `app/` for expo-router.

## License

Private/internal (add your preferred license if needed).
