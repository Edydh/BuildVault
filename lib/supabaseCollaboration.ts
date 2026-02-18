import type { PostgrestError, User as SupabaseUser } from '@supabase/supabase-js';
import {
  deleteOrganizationForCurrentUser,
  Organization,
  OrganizationMember,
  OrganizationMemberRole,
  mergeOrganizationSnapshotFromSupabase,
} from './db';
import { supabase } from './supabase';

type SupabaseOrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

type SupabaseOrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: OrganizationMemberRole;
  status: OrganizationMember['status'];
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
};

type SupabaseInviteMembershipWithOrg = SupabaseOrganizationMemberRow & {
  organizations: SupabaseOrganizationRow | SupabaseOrganizationRow[] | null;
};

type SupabaseActiveMembershipWithOrg = SupabaseOrganizationMemberRow & {
  organizations: SupabaseOrganizationRow | SupabaseOrganizationRow[] | null;
};

type InviteEmailFunctionResponse = {
  ok?: boolean;
  sent?: boolean;
  reason?: string;
  providerMessageId?: string | null;
};

export type OrganizationInviteDeliveryResult = {
  inviteId: string;
  emailSent: boolean;
  emailError: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toMillis(value?: string | null): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function normalizeRole(value: OrganizationMemberRole | null | undefined): OrganizationMemberRole {
  if (value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer') {
    return value;
  }
  return 'member';
}

function normalizeOrganizationRow(row: SupabaseOrganizationRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    owner_user_id: row.owner_user_id,
    created_at: toMillis(row.created_at),
    updated_at: toMillis(row.updated_at),
  };
}

function normalizeOrganizationMemberRow(row: SupabaseOrganizationMemberRow) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    invited_email: row.invited_email,
    role: normalizeRole(row.role),
    status: row.status === 'active' || row.status === 'invited' || row.status === 'removed' ? row.status : 'invited',
    invited_by: row.invited_by,
    created_at: toMillis(row.created_at),
    updated_at: toMillis(row.updated_at),
    accepted_at: row.accepted_at ? toMillis(row.accepted_at) : null,
  } as const;
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSlug(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : null;
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value.trim());
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

function resolveSingleOrganization(
  value: SupabaseOrganizationRow | SupabaseOrganizationRow[] | null
): SupabaseOrganizationRow | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function mergeErrors(error: PostgrestError | null | undefined, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function requireAuthUser(actionLabel: string): Promise<SupabaseUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error(error?.message || `Must be signed in to ${actionLabel}`);
  }
  return data.user;
}

export async function syncOrganizationDataFromSupabase(): Promise<void> {
  const authUser = await requireAuthUser('sync organization data');

  const normalizedEmail = normalizeEmail(authUser.email);

  const { data: activeMembershipsRaw, error: activeMembershipsError } = await supabase
    .from('organization_members')
    .select(
      'id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at, organizations!inner(id, name, slug, owner_user_id, created_at, updated_at)'
    )
    .eq('user_id', authUser.id)
    .eq('status', 'active');

  if (activeMembershipsError) {
    mergeErrors(activeMembershipsError, 'Failed to load active organization memberships');
  }

  const activeMemberships = (activeMembershipsRaw || []) as SupabaseActiveMembershipWithOrg[];
  const organizationsById = new Map<string, ReturnType<typeof normalizeOrganizationRow>>();
  const memberRowsById = new Map<string, ReturnType<typeof normalizeOrganizationMemberRow>>();

  for (const row of activeMemberships) {
    const organization = resolveSingleOrganization(row.organizations);
    if (organization) {
      organizationsById.set(organization.id, normalizeOrganizationRow(organization));
    }
    memberRowsById.set(row.id, normalizeOrganizationMemberRow(row));
  }

  const organizationIds = [...organizationsById.keys()];
  if (organizationIds.length > 0) {
    const { data: organizationMembersRaw, error: organizationMembersError } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at')
      .in('organization_id', organizationIds)
      .neq('status', 'removed');

    if (organizationMembersError) {
      mergeErrors(organizationMembersError, 'Failed to load organization members');
    }

    for (const row of (organizationMembersRaw || []) as SupabaseOrganizationMemberRow[]) {
      memberRowsById.set(row.id, normalizeOrganizationMemberRow(row));
    }
  }

  if (normalizedEmail) {
    const { data: inviteRowsRaw, error: inviteRowsError } = await supabase
      .from('organization_members')
      .select(
        'id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at, organizations!inner(id, name, slug, owner_user_id, created_at, updated_at)'
      )
      .eq('status', 'invited')
      .eq('invited_email', normalizedEmail);

    if (inviteRowsError) {
      mergeErrors(inviteRowsError, 'Failed to load organization invites');
    }

    for (const row of (inviteRowsRaw || []) as SupabaseInviteMembershipWithOrg[]) {
      const organization = resolveSingleOrganization(row.organizations);
      if (organization) {
        organizationsById.set(organization.id, normalizeOrganizationRow(organization));
      }
      memberRowsById.set(row.id, normalizeOrganizationMemberRow(row));
    }
  }

  mergeOrganizationSnapshotFromSupabase({
    currentAuthUserId: authUser.id,
    organizations: [...organizationsById.values()],
    members: [...memberRowsById.values()],
  });
}

export async function createOrganizationInSupabase(data: {
  name: string;
  slug?: string | null;
}): Promise<Organization> {
  const authUser = await requireAuthUser('create an organization');

  const name = data.name.trim();
  if (!name) throw new Error('Organization name is required');

  const { data: created, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug: normalizeSlug(data.slug ?? name),
      owner_user_id: authUser.id,
    })
    .select('id, name, slug, owner_user_id, created_at, updated_at')
    .single();

  if (error || !created) {
    mergeErrors(error, 'Unable to create organization');
  }

  await syncOrganizationDataFromSupabase();

  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    owner_user_id: created.owner_user_id,
    created_at: toMillis(created.created_at),
    updated_at: toMillis(created.updated_at),
  };
}

export async function inviteOrganizationMemberInSupabase(data: {
  organizationId: string;
  email: string;
  role?: Exclude<OrganizationMemberRole, 'owner'>;
}): Promise<OrganizationInviteDeliveryResult> {
  const authUser = await requireAuthUser('invite organization members');

  const normalizedEmail = normalizeEmail(data.email);
  if (!normalizedEmail) {
    throw new Error('Invite email is required');
  }

  const role = data.role === 'admin' || data.role === 'viewer' ? data.role : 'member';

  const { data: existingRows, error: existingError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', data.organizationId)
    .eq('invited_email', normalizedEmail)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) {
    mergeErrors(existingError, 'Unable to inspect existing invite');
  }

  const existingId = existingRows?.[0]?.id;
  let inviteId: string | null = existingId ?? null;
  if (existingId) {
    const { error: updateError } = await supabase
      .from('organization_members')
      .update({
        role,
        status: 'invited',
        invited_email: normalizedEmail,
        invited_by: authUser.id,
        accepted_at: null,
      })
      .eq('id', existingId)
      .eq('organization_id', data.organizationId);

    if (updateError) {
      mergeErrors(updateError, 'Unable to update existing invite');
    }
  } else {
    const { data: insertedRow, error: insertError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: data.organizationId,
        invited_email: normalizedEmail,
        role,
        status: 'invited',
        invited_by: authUser.id,
      })
      .select('id')
      .single();

    if (insertError) {
      mergeErrors(insertError, 'Unable to create invitation');
    }

    inviteId = insertedRow?.id ?? null;
  }

  if (!inviteId) {
    throw new Error('Invitation created but missing invite identifier');
  }

  let emailSent = false;
  let emailError: string | null = null;
  try {
    const { data: functionData, error: functionError } = await supabase.functions.invoke<InviteEmailFunctionResponse>(
      'send-organization-invite',
      {
        body: {
          inviteId,
          organizationId: data.organizationId,
          invitedEmail: normalizedEmail,
          role,
        },
      }
    );

    if (functionError) {
      emailError = functionError.message || 'Unable to invoke invite email function';
    } else {
      emailSent = functionData?.sent === true;
      if (!emailSent && functionData?.reason) {
        emailError = functionData.reason;
      }
    }
  } catch (error) {
    emailError = errorMessage(error);
  }

  await syncOrganizationDataFromSupabase();
  return {
    inviteId,
    emailSent,
    emailError,
  };
}

export async function acceptOrganizationInviteInSupabase(inviteId: string): Promise<string> {
  const authUser = await requireAuthUser('accept organization invite');

  const normalizedEmail = normalizeEmail(authUser.email);
  if (!normalizedEmail) {
    throw new Error('Signed-in user does not have an email address');
  }

  const { data: inviteLookupRow, error: inviteLookupError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('id', inviteId)
    .eq('status', 'invited')
    .eq('invited_email', normalizedEmail)
    .maybeSingle();

  if (inviteLookupError) {
    mergeErrors(inviteLookupError, 'Unable to find invitation');
  }
  if (!inviteLookupRow) {
    throw new Error('Invitation not found or no longer available');
  }

  const { error: updateError } = await supabase
    .from('organization_members')
    .update({
      user_id: authUser.id,
      invited_email: normalizedEmail,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', inviteId)
    .eq('status', 'invited')
    .eq('invited_email', normalizedEmail);

  if (updateError) {
    mergeErrors(updateError, 'Unable to accept invite');
  }

  await syncOrganizationDataFromSupabase();
  return inviteLookupRow.organization_id;
}

export async function setOrganizationMemberRoleInSupabase(data: {
  organizationId: string;
  memberId: string;
  role: OrganizationMemberRole;
}): Promise<void> {
  await requireAuthUser('update organization member role');
  const role = normalizeRole(data.role);

  const { error } = await supabase
    .from('organization_members')
    .update({
      role,
    })
    .eq('organization_id', data.organizationId)
    .eq('id', data.memberId);

  if (error) {
    mergeErrors(error, 'Unable to update member role');
  }

  await syncOrganizationDataFromSupabase();
}

export async function removeOrganizationMemberInSupabase(data: {
  organizationId: string;
  memberId: string;
}): Promise<void> {
  await requireAuthUser('remove organization member');
  const { error } = await supabase
    .from('organization_members')
    .update({
      status: 'removed',
    })
    .eq('organization_id', data.organizationId)
    .eq('id', data.memberId);

  if (error) {
    mergeErrors(error, 'Unable to remove member');
  }

  await syncOrganizationDataFromSupabase();
}

export async function deleteOrganizationInSupabase(organizationId: string): Promise<void> {
  await requireAuthUser('delete organization');
  const normalizedId = organizationId.trim();
  if (!normalizedId) {
    throw new Error('Organization ID is required');
  }

  if (!isUuid(normalizedId)) {
    // Legacy local-only organization IDs cannot be deleted from Supabase.
    deleteOrganizationForCurrentUser(normalizedId);
    return;
  }

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', normalizedId);

  if (error) {
    mergeErrors(error, 'Unable to delete organization');
  }

  deleteOrganizationForCurrentUser(normalizedId);
  await syncOrganizationDataFromSupabase();
}
