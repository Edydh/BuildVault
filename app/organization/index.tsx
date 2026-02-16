import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import {
  Organization,
  OrganizationInvite,
  OrganizationMember,
  OrganizationMemberRole,
  acceptOrganizationInvite,
  createOrganization,
  getOrganizationMembers,
  getOrganizationsForCurrentUser,
  getPendingOrganizationInvitesForCurrentUser,
  inviteOrganizationMember,
} from '../../lib/db';
import { BVButton, BVCard, BVEmptyState, BVHeader } from '../../components/ui';
import { GlassTextInput } from '../../components/glass';
import { bvColors, bvFx, bvSpacing } from '../../lib/theme/tokens';

const INVITE_ROLES: Array<Exclude<OrganizationMemberRole, 'owner'>> = ['admin', 'member', 'viewer'];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unexpected error';
}

function labelFromRole(role: OrganizationMemberRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  if (role === 'viewer') return 'Viewer';
  return 'Member';
}

export default function OrganizationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);

  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<OrganizationMemberRole, 'owner'>>('member');

  const loadData = useCallback((preferredOrgId?: string | null) => {
    try {
      const nextOrganizations = getOrganizationsForCurrentUser();
      const nextInvites = getPendingOrganizationInvitesForCurrentUser();

      const fallbackSelectedId =
        (preferredOrgId && nextOrganizations.some((item) => item.id === preferredOrgId) && preferredOrgId) ||
        (selectedOrgId && nextOrganizations.some((item) => item.id === selectedOrgId) && selectedOrgId) ||
        nextOrganizations[0]?.id ||
        null;

      const nextMembers = fallbackSelectedId ? getOrganizationMembers(fallbackSelectedId) : [];

      setOrganizations(nextOrganizations);
      setInvites(nextInvites);
      setSelectedOrgId(fallbackSelectedId);
      setMembers(nextMembers);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );

  const myMembership = useMemo(
    () => members.find((member) => member.user_id === user?.id) ?? null,
    [members, user?.id]
  );

  const canManageMembers = myMembership?.role === 'owner' || myMembership?.role === 'admin';

  const handleCreateOrganization = () => {
    const name = orgName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please provide an organization name.');
      return;
    }

    try {
      setBusy(true);
      const created = createOrganization({
        name,
        slug: orgSlug.trim() || null,
      });
      setOrgName('');
      setOrgSlug('');
      loadData(created.id);
      Alert.alert('Organization created', `${created.name} is ready. You can now invite members.`);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSelectOrganization = (organizationId: string) => {
    try {
      const nextMembers = getOrganizationMembers(organizationId);
      setSelectedOrgId(organizationId);
      setMembers(nextMembers);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    }
  };

  const handleInviteMember = () => {
    if (!selectedOrgId) {
      Alert.alert('Select organization', 'Choose an organization first.');
      return;
    }
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address to send an invitation.');
      return;
    }

    try {
      setBusy(true);
      inviteOrganizationMember({
        organizationId: selectedOrgId,
        email,
        role: inviteRole,
        invitedBy: user?.id ?? null,
      });
      setInviteEmail('');
      const nextMembers = getOrganizationMembers(selectedOrgId);
      setMembers(nextMembers);
      loadData(selectedOrgId);
      Alert.alert('Invitation sent', `Invite sent to ${email}.`);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = (inviteId: string) => {
    try {
      setBusy(true);
      const accepted = acceptOrganizationInvite(inviteId);
      loadData(accepted.organization_id);
      Alert.alert('Joined organization', 'Invitation accepted successfully.');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
      <BVHeader
        title="Organization"
        subtitle="Create organizations and manage members"
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <ActivityIndicator color={bvColors.brand.primaryLight} />
            <Text style={{ color: bvColors.text.muted, marginTop: 12 }}>Loading organization data...</Text>
          </View>
        ) : null}

        {!loading && invites.length > 0 ? (
          <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
            <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
              Pending Invitations
            </Text>
            {invites.map((invite) => (
              <View
                key={invite.id}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: bvFx.glassBorderSoft,
                  backgroundColor: bvFx.glassSoft,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: bvColors.text.primary, fontSize: 15, fontWeight: '700' }}>
                  {invite.organization_name}
                </Text>
                <Text style={{ color: bvColors.text.muted, marginTop: 2 }}>
                  Role: {labelFromRole(invite.role)}
                </Text>
                <BVButton
                  title="Accept Invite"
                  onPress={() => handleAcceptInvite(invite.id)}
                  style={{ marginTop: 10 }}
                  icon="checkmark-circle-outline"
                  disabled={busy}
                />
              </View>
            ))}
          </BVCard>
        ) : null}

        <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
          <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
            Create Organization
          </Text>
          <GlassTextInput
            label="Organization Name"
            value={orgName}
            onChangeText={setOrgName}
            placeholder="Example: BuildVault Contractors"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <GlassTextInput
            label="Slug (Optional)"
            value={orgSlug}
            onChangeText={setOrgSlug}
            placeholder="buildvault-contractors"
            autoCapitalize="none"
            helperText="Used for unique organization identity and public links."
          />
          <BVButton
            title="Create Organization"
            icon="business-outline"
            onPress={handleCreateOrganization}
            disabled={busy}
            loading={busy}
          />
        </BVCard>

        {!loading && organizations.length === 0 ? (
          <BVEmptyState
            title="No organizations yet"
            description="Create one to start inviting teammates and assigning projects under a company."
            icon="business-outline"
          />
        ) : null}

        {!loading && organizations.length > 0 ? (
          <>
            <View style={{ marginTop: 4, marginBottom: 10 }}>
              <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700' }}>
                Your Organizations
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', paddingRight: 4 }}>
                {organizations.map((org) => {
                  const selected = org.id === selectedOrgId;
                  return (
                    <TouchableOpacity
                      key={org.id}
                      onPress={() => handleSelectOrganization(org.id)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? bvFx.brandBorder : bvFx.glassBorderSoft,
                        backgroundColor: selected ? bvFx.brandSoft : bvFx.glassSoft,
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? bvColors.brand.primaryLight : bvColors.text.secondary,
                          fontSize: 13,
                          fontWeight: '700',
                        }}
                      >
                        {org.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {selectedOrganization ? (
              <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
                <Text style={{ color: bvColors.text.primary, fontSize: 20, fontWeight: '700' }}>
                  {selectedOrganization.name}
                </Text>
                <Text style={{ color: bvColors.text.muted, marginTop: 4 }}>
                  Slug: {selectedOrganization.slug || 'Not set'}
                </Text>
                <Text style={{ color: bvColors.text.muted, marginTop: 2 }}>
                  {members.length} member{members.length === 1 ? '' : 's'}
                </Text>
                {myMembership ? (
                  <View
                    style={{
                      marginTop: 10,
                      alignSelf: 'flex-start',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderWidth: 1,
                      borderColor: bvFx.brandBorder,
                      backgroundColor: bvFx.brandSoft,
                    }}
                  >
                    <Text style={{ color: bvColors.brand.primaryLight, fontSize: 12, fontWeight: '700' }}>
                      You are {labelFromRole(myMembership.role)}
                    </Text>
                  </View>
                ) : null}
              </BVCard>
            ) : null}

            <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
              <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
                Members
              </Text>
              {members.length === 0 ? (
                <Text style={{ color: bvColors.text.muted }}>No members in this organization yet.</Text>
              ) : (
                members.map((member) => (
                  <View
                    key={member.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: bvFx.glassBorderSoft,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: bvColors.text.primary, fontSize: 14, fontWeight: '600' }}>
                        {member.user_id === user?.id
                          ? `${user?.name || 'You'} (You)`
                          : member.invited_email || `Member ${member.user_id?.slice(0, 8) || ''}`}
                      </Text>
                      <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 2 }}>
                        {member.status === 'invited' ? 'Invitation pending' : 'Active member'}
                      </Text>
                    </View>
                    <View
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: bvFx.glassBorderSoft,
                        backgroundColor: bvFx.glassSoft,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ color: bvColors.text.secondary, fontSize: 11, fontWeight: '700' }}>
                        {labelFromRole(member.role)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </BVCard>

            <BVCard contentStyle={{ padding: 14 }}>
              <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
                Invite Member
              </Text>
              {canManageMembers ? (
                <>
                  <GlassTextInput
                    label="Email"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="teammate@company.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />

                  <Text style={{ color: bvColors.text.muted, marginBottom: 8 }}>Role</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                    {INVITE_ROLES.map((role) => {
                      const selected = role === inviteRole;
                      return (
                        <TouchableOpacity
                          key={role}
                          onPress={() => setInviteRole(role)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selected ? bvFx.brandBorder : bvFx.glassBorderSoft,
                            backgroundColor: selected ? bvFx.brandSoft : bvFx.glassSoft,
                            marginRight: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? bvColors.brand.primaryLight : bvColors.text.secondary,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {labelFromRole(role)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <BVButton
                    title="Send Invitation"
                    icon="mail-outline"
                    onPress={handleInviteMember}
                    disabled={busy}
                    loading={busy}
                  />
                </>
              ) : (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: bvFx.glassBorderSoft,
                    backgroundColor: bvFx.glassSoft,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: bvColors.text.muted }}>
                    Only owner or admin can invite members.
                  </Text>
                </View>
              )}
            </BVCard>
          </>
        ) : null}

        <View style={{ paddingTop: bvSpacing[24] }}>
          <Text style={{ color: bvColors.text.tertiary, fontSize: 12, lineHeight: 18 }}>
            Ownership note: the creator is treated as organization owner in-app. Legal verification
            (domain/doc checks) can be added in a later release.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
