# BuildVault — Construction Project Media Organizer (Expo)

Small-but-mighty, field-ready app for construction professionals to capture, organize, and share project media (photos, videos, and documents). Built with Expo SDK 52, TypeScript, expo-router, and NativeWind (Tailwind).

## Highlights
- Projects: create, view, delete, and share
- Per-project media: photos, videos, and documents
- Capture via device camera + document picker
- Notes & timestamps; multi-select share
- Offline-first: files stored locally; metadata in SQLite
- Liquid Glass UI

## Tech Stack
- Runtime: Expo SDK 52 (React Native)
- Routing: expo-router
- Styling: NativeWind (Tailwind) + expo-blur
- Media: expo-camera, expo-image, expo-video-thumbnails, expo-document-picker
- Storage: expo-file-system, expo-sqlite
- Share: expo-sharing
- Icons/Haptics: @expo/vector-icons, expo-haptics

## Quick Start

1) Install prerequisites
- Node 18+ (20 recommended)
- Xcode (iOS) / Android Studio (Android)
- Expo CLI: `npm i -g expo`

2) Install dependencies

```bash
npm i
```

3) Start the app

```bash
npm run start
# press "i" for iOS simulator, "a" for Android
```

## Configuration

- `tailwind.config.js` is set with the BuildVault palette and glass shadows.
- `babel.config.js` includes `nativewind/babel` and `expo-router/babel`.
- `app.json` includes required iOS/Android permissions and `expo-router` plugin.
- TypeScript is in strict mode (see `tsconfig.json`).
- Basic ESLint + Prettier configs included.

## Project Structure

```
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx                # Projects list (search + create FAB)
    settings.tsx             # Placeholder for v1
  project/
    [id]/index.tsx           # Project overview (tabs, filters, multi-select, share, delete)
    [id]/capture.tsx         # Camera + document picker, add note
    [id]/media/[mediaId].tsx # Media detail (view, note, share, delete)
components/
  GlassCard.tsx
  ProjectCard.tsx
  MediaGrid.tsx
  Header.tsx
lib/
  db.ts                      # SQLite helper + migrations
  files.ts                   # Paths and safe FS operations
  media.ts                   # Thumbnails, copying docs, capture utils
  format.ts                  # Dates, byte sizes
assets/
  icon.png splash.png (add your own)
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

- Offline-first: all data stored locally (SQLite + filesystem). No network required.
- Friendly permission prompts; screens remain stable when permissions are denied.
- Multi-share is implemented by iterating selected items.

## Development Tips

- Tailwind classes are used sparingly to keep UI readable.
- Keep components small; most data access goes through `lib/db.ts`.
- If you add new screens, ensure they live under `app/` for expo-router.

## License

Private/internal (add your preferred license if needed).

