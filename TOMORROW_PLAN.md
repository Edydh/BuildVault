# BuildVault - Tomorrow's Development Plan 📅
**Date**: September 17, 2025  
**Current Status**: Phase 1 core glass foundations in place

---

## ✅ Today's Accomplishments (September 16, 2025)

### Glass Components & Primitives
- Added `GlassTextInput`, `GlassSwitch`, `GlassFAB`, `GlassModal`, `GlassActionSheet` ✅
- Exported via `components/glass/index.ts` and documented usage ✅

### Screen Integrations
- Projects tab: upgraded “Add Project” to glass FAB ✅
- New Project modal: moved to `GlassModal` and inputs to `GlassTextInput` ✅
- Edit Project modal: centered, polished with `GlassModal` + glass inputs ✅
- Project Detail: camera FAB, Create Folder modal → `GlassModal` ✅

### Action Sheets
- Replaced system alerts with `GlassActionSheet`:
  - Project Options (Edit/Share/Delete) ✅
  - Clear All Data (Settings) ✅
  - Move Media (folder picker) ✅
  - Delete Media confirmation ✅

### Auth Polish
- Legal links simplified to inline hyperlinks; visibility improved ✅

---

## 🎯 Updated Priorities (September 17, 2025)

### ✅ Completed Since Last Plan
- Gallery screen (`app/project/[id]/gallery.tsx`) now runs full glass header, overlays, and delete/share action sheets.
- Media detail screen (`app/project/[id]/media/[mediaId].tsx`) ships with glass toolbars, overlays, and Hermes-ready action sheets.
- FAB spacing helpers (`components/glass/layout.ts`) and Android input focus polish (`components/glass/GlassTextInput.tsx`) verified across project flows.

### Priority 1: Performance & QA
- Audit blur intensity on Android (prefer darker bg + lower blur)
- Test heavy lists (grid/list) for frame drops
- Add quick perf flag in `GlassThemeProvider` (reduced effects)

### Priority 2: Consistency & Polish
- Reconfirm safe-area and keyboard avoidance in all modals after recent tweaks
- Spot-check FAB alignment in edge cases (e.g., tablets, landscape)
- Ensure glass overlays degrade gracefully when `quickPerformanceMode` is active

### Priority 3: Nice-to-haves (time permitting)
- Convert remaining alerts (Sign Out sheet already routed) and About dialog
- Add light haptics on action-sheet selections and critical buttons

---

## 📋 Timeboxed Plan

Morning (9–12)
- Run Android blur/performance audit across gallery and media detail
- Add/verify quick performance flag handling in `GlassThemeProvider`

Afternoon (1–5)
- Stress-test large project galleries and grids; profile for frame drops
- Revisit modal safe-area + keyboard avoidance; adjust spacing helpers if needed

Late (5–6)
- QA pass on both platforms with `quickPerformanceMode` toggled
- Commit, push, and capture perf findings in docs

---

## 📊 Success Criteria
- Gallery and Media Detail use glass components end‑to‑end
- No layout regressions; inputs readable on Android
- 60fps feel on typical devices; no new crashes

---

## 🔎 Risks / Watch‑outs
- Blur + gradients stacking on Android → keep opacity high, blur low
- Keyboard overlap in modals → verify `KeyboardAvoidingView`

---

## 📝 Notes
- Prefer darker backgrounds on Android (`rgba(16,24,38,…)`) with `tint="dark"`
- Use `GlassActionSheet` for all destructive actions going forward
