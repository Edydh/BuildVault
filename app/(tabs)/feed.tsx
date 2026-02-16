import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BVCard, BVEmptyState, BVHeader, BVSearchBar } from '../../components/ui';
import { Organization, PublicProjectSummary, getOrganizationsForCurrentUser, getPublicProjectFeed } from '../../lib/db';
import { bvColors, bvFx } from '../../lib/theme/tokens';
import { WorkspaceSelection, getStoredWorkspace, setStoredWorkspace } from '../../lib/workspace';

export default function FeedTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [feedItems, setFeedItems] = useState<PublicProjectSummary[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSelection>({ type: 'personal' });

  const loadFeed = useCallback(() => {
    try {
      const items = getPublicProjectFeed(60, 0);
      setFeedItems(items);
    } catch (error) {
      console.error('Failed to load public feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
      (async () => {
        try {
          const [storedWorkspace] = await Promise.all([
            getStoredWorkspace(),
          ]);
          const orgs = getOrganizationsForCurrentUser();
          let nextWorkspace = storedWorkspace;
          if (
            storedWorkspace.type === 'organization' &&
            !orgs.some((organization) => organization.id === storedWorkspace.organizationId)
          ) {
            nextWorkspace = { type: 'personal' };
            await setStoredWorkspace(nextWorkspace);
          }
          setOrganizations(orgs);
          setWorkspace(nextWorkspace);
        } catch (error) {
          console.error('Failed to load workspace for feed:', error);
        }
      })();
    }, [loadFeed])
  );

  const filteredItems = useMemo(() => {
    const scopedItems =
      workspace.type === 'organization'
        ? feedItems.filter((item) => item.organization_id === workspace.organizationId)
        : feedItems;

    const term = search.trim().toLowerCase();
    if (!term) return scopedItems;
    return scopedItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(term) ||
        (item.summary || '').toLowerCase().includes(term) ||
        (item.organization_name || '').toLowerCase().includes(term) ||
        (item.city || '').toLowerCase().includes(term) ||
        (item.region || '').toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term)
      );
    });
  }, [feedItems, search, workspace]);

  const activeWorkspaceLabel = useMemo(() => {
    if (workspace.type === 'organization') {
      const organization = organizations.find((item) => item.id === workspace.organizationId);
      return organization?.name || 'Organization';
    }
    return 'All Public Projects';
  }, [workspace, organizations]);

  const selectWorkspace = async (nextWorkspace: WorkspaceSelection) => {
    setWorkspace(nextWorkspace);
    try {
      await setStoredWorkspace(nextWorkspace);
    } catch (error) {
      console.error('Failed to save workspace selection:', error);
    }
  };

  const formatStatus = (value: string): string => {
    if (!value) return 'Neutral';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const getStatusTone = (value: string) => {
    if (value === 'active') {
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
        borderColor: 'rgba(34, 197, 94, 0.35)',
        textColor: '#4ADE80',
      };
    }
    if (value === 'delayed') {
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
        textColor: '#FBBF24',
      };
    }
    if (value === 'completed') {
      return {
        backgroundColor: bvFx.brandSoft,
        borderColor: bvFx.brandBorder,
        textColor: bvColors.brand.primaryLight,
      };
    }
    return {
      backgroundColor: bvFx.glassSoft,
      borderColor: bvFx.neutralBorder,
      textColor: bvColors.text.secondary,
    };
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
      <BVHeader
        title="Feed"
        subtitle={workspace.type === 'organization' ? `Public highlights for ${activeWorkspaceLabel}` : 'Public project highlights'}
        right={
          <TouchableOpacity
            onPress={handleRefresh}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: bvColors.surface.chrome,
              borderWidth: 1,
              borderColor: bvFx.glassBorderSoft,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="refresh" size={18} color={bvColors.text.primary} />
          </TouchableOpacity>
        }
      />

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <BVSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search public projects..."
        />
        {organizations.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingRight: 6 }}
          >
            <TouchableOpacity
              onPress={() => selectWorkspace({ type: 'personal' })}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: workspace.type === 'personal' ? bvFx.brandBorder : bvFx.glassBorderSoft,
                backgroundColor: workspace.type === 'personal' ? bvFx.brandSoft : bvFx.glassSoft,
                paddingHorizontal: 12,
                paddingVertical: 7,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  color: workspace.type === 'personal' ? bvColors.brand.primaryLight : bvColors.text.secondary,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                All Public
              </Text>
            </TouchableOpacity>
            {organizations.map((organization) => {
              const selected = workspace.type === 'organization' && workspace.organizationId === organization.id;
              return (
                <TouchableOpacity
                  key={organization.id}
                  onPress={() => selectWorkspace({ type: 'organization', organizationId: organization.id })}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? bvFx.brandBorder : bvFx.glassBorderSoft,
                    backgroundColor: selected ? bvFx.brandSoft : bvFx.glassSoft,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
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
                    {organization.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={bvColors.brand.primaryLight} />}
      >
        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <Text style={{ color: bvColors.text.muted }}>Loading feed...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <BVEmptyState
            title="No projects for this workspace"
            description={
              workspace.type === 'organization'
                ? 'No public projects are published for the selected organization yet.'
                : 'Publish a project to make it appear in the feed.'
            }
            icon="globe-outline"
            style={{ marginTop: 48 }}
          />
        ) : (
          filteredItems.map((item) => {
            const statusTone = getStatusTone(item.status);
            return (
              <BVCard
                key={item.project_id}
                onPress={() => router.push(`/public/${encodeURIComponent(item.public_slug)}`)}
                style={{ marginBottom: 14 }}
                contentStyle={{ padding: 0 }}
              >
                <View style={{ borderRadius: 14, overflow: 'hidden' }}>
                  {item.hero_thumb_uri ? (
                    <ExpoImage
                      source={{ uri: item.hero_thumb_uri }}
                      style={{
                        width: '100%',
                        height: 160,
                        backgroundColor: bvColors.surface.muted,
                      }}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View
                      style={{
                        width: '100%',
                        height: 160,
                        backgroundColor: bvColors.surface.muted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="image-outline" size={28} color={bvColors.text.tertiary} />
                    </View>
                  )}

                  <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 10 }}>
                        {item.title}
                      </Text>
                      <View
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          backgroundColor: statusTone.backgroundColor,
                          borderWidth: 1,
                          borderColor: statusTone.borderColor,
                        }}
                      >
                        <Text style={{ color: statusTone.textColor, fontSize: 11, fontWeight: '700' }}>
                          {formatStatus(item.status)}
                        </Text>
                      </View>
                    </View>

                    {item.summary ? (
                      <Text
                        numberOfLines={2}
                        style={{ color: bvColors.text.secondary, fontSize: 14, marginTop: 8, lineHeight: 20 }}
                      >
                        {item.summary}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                      <Ionicons name="location-outline" size={14} color={bvColors.text.tertiary} />
                      <Text style={{ color: bvColors.text.muted, fontSize: 12, marginLeft: 4, flex: 1 }}>
                        {[item.city, item.region].filter(Boolean).join(', ') || 'Location not specified'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      <Text style={{ color: bvColors.text.muted, fontSize: 12, flex: 1 }}>
                        {item.organization_name || 'Independent Project'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: bvFx.glassBorderSoft,
                            backgroundColor: bvFx.glassSoft,
                            marginRight: 6,
                          }}
                        >
                          <Text style={{ color: bvColors.text.secondary, fontSize: 11, fontWeight: '600' }}>
                            {item.media_count} media
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: bvFx.glassBorderSoft,
                            backgroundColor: bvFx.glassSoft,
                          }}
                        >
                          <Text style={{ color: bvColors.text.secondary, fontSize: 11, fontWeight: '600' }}>
                            {item.progress}% progress
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </BVCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
