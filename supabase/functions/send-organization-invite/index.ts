import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

type SendInvitePayload = {
  inviteId: string;
  organizationId: string;
  invitedEmail: string;
  role: 'admin' | 'member' | 'viewer';
};

type OrganizationInviteRow = {
  id: string;
  organization_id: string;
  invited_email: string | null;
  role: 'admin' | 'member' | 'viewer' | 'owner';
  status: 'invited' | 'active' | 'removed';
  organizations: { name: string; slug: string | null } | Array<{ name: string; slug: string | null }> | null;
};

type MemberRoleRow = {
  role: 'owner' | 'admin' | 'member' | 'viewer';
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeRole(value: unknown): 'admin' | 'member' | 'viewer' {
  if (value === 'admin' || value === 'viewer') return value;
  return 'member';
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function firstOrganization(
  value: OrganizationInviteRow['organizations']
): { name: string; slug: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function buildAcceptLink(inviteId: string): string {
  const base = Deno.env.get('INVITE_DEEP_LINK_BASE') || 'buildvault://organization';
  const delimiter = base.includes('?') ? '&' : '?';
  return `${base}${delimiter}inviteId=${encodeURIComponent(inviteId)}`;
}

function roleLabel(role: 'admin' | 'member' | 'viewer'): string {
  if (role === 'admin') return 'Admin';
  if (role === 'viewer') return 'Viewer';
  return 'Member';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { ok: false, error: 'missing_authorization' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json(500, { ok: false, error: 'missing_supabase_environment' });
  }

  let payload: SendInvitePayload;
  try {
    const body = (await req.json()) as Partial<SendInvitePayload>;
    const inviteId = (body.inviteId || '').trim();
    const organizationId = (body.organizationId || '').trim();
    const invitedEmail = normalizeEmail(body.invitedEmail);
    if (!inviteId || !organizationId || !invitedEmail) {
      return json(400, { ok: false, error: 'invalid_payload' });
    }
    payload = {
      inviteId,
      organizationId,
      invitedEmail,
      role: normalizeRole(body.role),
    };
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json(401, { ok: false, error: 'unauthorized' });
  }

  const authUserId = authData.user.id;
  const { data: membership, error: membershipError } = await userClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', payload.organizationId)
    .eq('user_id', authUserId)
    .eq('status', 'active')
    .maybeSingle<MemberRoleRow>();

  if (membershipError) {
    return json(500, { ok: false, error: 'membership_lookup_failed', details: membershipError.message });
  }

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return json(403, { ok: false, error: 'forbidden' });
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: inviteRow, error: inviteError } = await serviceClient
    .from('organization_members')
    .select('id, organization_id, invited_email, role, status, organizations!inner(name, slug)')
    .eq('id', payload.inviteId)
    .eq('organization_id', payload.organizationId)
    .maybeSingle<OrganizationInviteRow>();

  if (inviteError) {
    return json(500, { ok: false, error: 'invite_lookup_failed', details: inviteError.message });
  }

  if (!inviteRow || inviteRow.status !== 'invited') {
    return json(404, { ok: false, error: 'invite_not_found' });
  }

  const rowEmail = normalizeEmail(inviteRow.invited_email);
  if (!rowEmail || rowEmail !== payload.invitedEmail) {
    return json(409, { ok: false, error: 'invite_email_mismatch' });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('INVITE_EMAIL_FROM');
  const acceptLink = buildAcceptLink(payload.inviteId);

  if (!resendApiKey || !emailFrom) {
    return json(200, {
      ok: true,
      sent: false,
      reason: 'email_provider_not_configured',
      acceptLink,
    });
  }

  const org = firstOrganization(inviteRow.organizations);
  const orgName = org?.name || 'BuildVault Organization';
  const inviteRole = roleLabel(payload.role);

  const subject = `You're invited to ${orgName} on BuildVault`;
  const text = [
    `You've been invited to join ${orgName} as ${inviteRole}.`,
    '',
    'Open this link on your mobile device:',
    acceptLink,
    '',
    'Then sign in with this email and accept from Pending Invitations.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">You're invited to ${orgName}</h2>
      <p style="margin:0 0 12px;">Role: <strong>${inviteRole}</strong></p>
      <p style="margin:0 0 16px;">Open BuildVault to accept your invitation:</p>
      <p style="margin:0 0 16px;">
        <a href="${acceptLink}" style="display:inline-block;padding:10px 14px;background:#1C3F94;color:#fff;text-decoration:none;border-radius:8px;">
          Open BuildVault Invitation
        </a>
      </p>
      <p style="margin:0;color:#475569;font-size:13px;">If the button does not open the app, use this link directly:</p>
      <p style="margin:6px 0 0;color:#1e293b;font-size:13px;word-break:break-all;">${acceptLink}</p>
    </div>
  `;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [payload.invitedEmail],
      subject,
      html,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const details = (await resendResponse.text()).slice(0, 600);
    return json(200, {
      ok: true,
      sent: false,
      reason: 'email_delivery_failed',
      details,
      acceptLink,
    });
  }

  const resendBody = (await resendResponse.json()) as { id?: string };
  return json(200, {
    ok: true,
    sent: true,
    provider: 'resend',
    providerMessageId: resendBody.id || null,
    acceptLink,
  });
});
