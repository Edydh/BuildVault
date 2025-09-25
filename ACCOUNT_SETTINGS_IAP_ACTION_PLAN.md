# BuildVault — Account Settings & Subscription (IAP) Action Plan

**Last Updated:** 2025-09-25  
**Owner:** BuildVault Dev  
**Status:** READY FOR IMPLEMENTATION

---

## Overview
Enhance the Settings > Account section with a polished, informative card and lay groundwork for Free vs Premium tiers using in‑app purchases. This plan is UI‑first, incremental, and safe. Subscription plumbing is staged to follow once UX and local persistence are in place.

## Goals
- Clear account presentation (avatar/initials, provider chip, membership info).
- Helpful actions (copy email, edit name, support, legal).
- Plan tier badge (Free/Premium) and upgrade path.
- Minimal risk: no breaking auth/storage; changes gated and incremental.

## UX Improvements
- Avatar + initials fallback
  - Show `user.avatar` if present; otherwise circle with initials from `user.name` or email.
- Provider chip
  - Small Apple/Google icon + “Signed in with Apple/Google”.
- Membership info
  - “Plan: Free/Premium”, “Member since”, “Last sign‑in”.
- Quick actions row
  - Copy Email, Edit Name (modal), Support email launcher, Privacy & Terms links.
- Primary actions
  - Free: “Upgrade to Premium” (opens paywall modal).
  - Premium: “Manage Subscription”, “Restore Purchases”.
  - Keep “Sign Out” clear and safe.
- Glass UI polish
  - Use `GlassCard`, compact header, subtle borders, respect `quickPerformanceMode`.

## Data Model (Local + Future‑Ready)
Add optional fields to support tiers and purchase info. Defaults keep existing users on Free without disruption.

Proposed SQLite columns on `users` (lib/db.ts):
- `plan_tier` TEXT DEFAULT 'free'         // 'free' | 'premium'
- `plan_source` TEXT                      // 'apple' | 'google' | 'redeem' | 'admin'
- `plan_expires_at` INTEGER NULL          // epoch ms (subscriptions)
- `plan_auto_renew` INTEGER DEFAULT 0     // 0/1
- `purchase_platform` TEXT NULL           // 'ios' | 'android'
- `purchase_product_id` TEXT NULL
- `purchase_transaction_id` TEXT NULL
- `last_verified_at` INTEGER NULL         // epoch ms of last receipt check

Auth/User type (lib/AuthContext.ts):
- Mirror above fields; add selectors/helpers: `isPremium(user)`, `daysLeft()`.

## Feature Gating (Soft)
Add utils (lib/subscription.ts):
- `isPremium(user): boolean` – premium if `plan_tier==='premium'` and not expired.
- `formatPlan(user): string` – e.g., `Premium (renews)`, `Free`.
- Use for gentle gating (show lock icons/CTAs for premium features while on Free).

## Settings Changes (UI)
File: `app/(tabs)/settings.tsx`
- Replace current Account block with a `GlassCard` that includes:
  - Header: Avatar + name/email + provider chip.
  - Info row: Plan badge (Free/Premium), member since, last sign‑in.
  - Action row: Copy Email, Edit Name, Support, Privacy & Terms.
  - Buttons: Upgrade/Manage/Restore (based on plan), plus Sign Out.
- Add “Edit Name” modal using `GlassModal` + `GlassTextInput`.
- Persist updated display name locally (and DB row if present).

## Paywall (UI‑Only First)
File: `components/Paywall.tsx`
- `GlassModal` with title “BuildVault Premium”, benefits list, placeholder price.
- Buttons: “Start Premium”, “Restore Purchases”, “Maybe later”.
- Wire from Settings “Upgrade to Premium”.

## IAP Integration Plan (Phase 2)
- Library: `expo-in-app-purchases`.
- Products: `com.buildvault.premium.monthly`, `com.buildvault.premium.yearly`.
- Flow:
  1) Connect, `getProductsAsync`
  2) `purchaseItemAsync(productId)`
  3) On success, set `plan_tier='premium'`, fill purchase fields, set `plan_expires_at` if sub, `plan_auto_renew`.
  4) Restore: purchase history → update fields.
  5) Verification (future): Supabase function or server endpoint; update `last_verified_at`.

## Analytics/Telemetry (Optional)
- Log upgrade/restore attempts and outcomes (local logs now; future: Supabase).

## Tasks & File Targets
- Schema + Types
  - [ ] lib/db.ts: add optional columns (ALTER TABLE guarded) and load/save helpers.
  - [ ] lib/AuthContext.ts: extend `User`, persist new fields, expose `isPremium`.
  - [ ] lib/subscription.ts: add gating utilities (`isPremium`, `formatPlan`, `daysLeft`).
- Settings UI
  - [ ] app/(tabs)/settings.tsx: avatar helper; new `GlassCard` layout for Account.
  - [ ] app/(tabs)/settings.tsx: actions row (copy/edit/support/legal).
  - [ ] app/(tabs)/settings.tsx: Edit Name modal.
  - [ ] app/(tabs)/settings.tsx: Upgrade/Manage/Restore buttons (open Paywall for now).
- Paywall
  - [ ] components/Paywall.tsx: modal UI and wiring from Settings.
- IAP (Phase 2)
  - [ ] Install and set up `expo-in-app-purchases`.
  - [ ] Product IDs and platform configs.
  - [ ] Purchase + restore handlers; update user fields; optimistic UI.
  - [ ] Optional: server verification hook.
- Gating Examples
  - [ ] Identify 1–2 premium features to gate softly (e.g., advanced exports, backup scheduling).

## Success Criteria
- Account card shows avatar/initials, provider chip, plan badge, member since, last sign‑in.
- Copy Email, Edit Name, Support, Privacy & Terms work.
- Upgrade/Restore buttons visible and responsive (UI‑only initially).
- Plan tier persists locally; Free is default; no auth regressions.

## Risks & Mitigation
- IAP complexity → Stage behind Paywall UI; ship UI first.
- Data migrations → Use `ALTER TABLE` guarded with try/catch; defaults preserve Free status.
- Receipt validation → Plan for server‑side in later iteration; store `last_verified_at`.

## Rollout Plan
1) Implement Settings Account UI + local plan badge (Free by default).
2) Add Paywall modal (UI‑only); wire Upgrade/Restore buttons.
3) Add DB columns + AuthContext fields (backward compatible), local persistence.
4) Integrate IAP in dev; enable behind feature flag; validate happy path on device.
5) Add restore flow; persist and surface state in Account card.
6) Optional: server‑side receipt verification.

## Notes
- Keep all new UI fast under `quickPerformanceMode` and `reduceTransparency`.
- Avoid changes to auth flows; only read/write user profile and plan fields.

---

### Quick Reference — Key Files
- Settings Account UI: `app/(tabs)/settings.tsx`
- DB + models: `lib/db.ts`
- Auth context: `lib/AuthContext.ts`
- Gating utils: `lib/subscription.ts`
- Paywall UI: `components/Paywall.tsx`

