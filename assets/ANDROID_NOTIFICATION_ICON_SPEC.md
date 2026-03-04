# Android Push Small Icon Spec (BuildVault)

Scope: Android push notification tray/status-bar small icon only.  
iOS notification appearance is unchanged.

## Target File
- Path: `assets/notification-icon.png`
- Format: PNG with transparent background
- Size: `96x96` px
- SVG source templates:
  - `assets/notification-icon-template.svg` (helmet + house, brand match)
  - `assets/notification-icon-template-house.svg` (house-only, max legibility)

## Visual Rules (Required)
- Glyph color: solid white only (`#FFFFFF`)
- Background: fully transparent
- No gradients
- No shadows/glows
- No anti-patterns with multiple colors
- No filled square/circle background behind the glyph

## Composition Rules
- Keep the glyph simple and bold (single silhouette style).
- Use approximately 70% of canvas area for the glyph.
- Keep even padding on all sides (roughly 14 px on a 96 px canvas).
- Minimum visible stroke thickness: ~3 px at 96 px export.

## Design Guidance
- Prefer a recognizable BuildVault mark simplified into a monochrome shape.
- Remove tiny interior details that disappear at status-bar size.
- Avoid thin outlines; use filled forms where possible.

## Acceptance Checklist
- Opens as `96x96` PNG.
- Transparent background confirmed.
- Non-transparent pixels are white only.
- Looks clear on both dark and light Android trays.
- No clipping at edges when rendered in notification shade.

## Build/Release Note
Changing the Android small icon is a native asset change. OTA updates do not apply this change.

After replacing `assets/notification-icon.png`:
1. Build Android preview again: `npx eas build --profile preview --platform android`
2. Install the new build on device
3. Retest push notification tray appearance
