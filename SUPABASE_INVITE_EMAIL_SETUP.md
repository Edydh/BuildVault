# BuildVault Invite Email Setup (Supabase Edge Function)

This enables automatic invite emails when an organization member is invited.

## What is wired in app

- Inviting a member still creates `organization_members` with `status = 'invited'`.
- App now invokes Edge Function: `send-organization-invite`.
- If email delivery is unavailable, invite creation still succeeds and the invited user can accept in-app from **Pending Invitations**.

## Edge Function path

- `/Users/edydh/Documents/BuildVault/supabase/functions/send-organization-invite/index.ts`

## Required function secrets

Set these in Supabase project secrets:

- `RESEND_API_KEY`
- `INVITE_EMAIL_FROM` (example: `BuildVault <onboarding@resend.dev>` for testing)
- `INVITE_DEEP_LINK_BASE` (default is `buildvault://organization`)

Supabase-provided secrets are also required:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

1. Install Supabase CLI and login.
2. Link project:
   - `supabase link --project-ref <your-project-ref>`
3. Set secrets:
   - `supabase secrets set RESEND_API_KEY=... INVITE_EMAIL_FROM=\"BuildVault <...>\" INVITE_DEEP_LINK_BASE=\"buildvault://organization\"`
4. Deploy function:
   - `supabase functions deploy send-organization-invite`

## Test flow

1. In app, create/select organization.
2. Invite an email.
3. Confirm:
   - You see success alert.
   - Invite row exists in `organization_members`.
   - Email arrives with a deep link.

## Notes

- A custom domain is not required for app deep links.
- For production email deliverability, use a verified sender domain in Resend.
