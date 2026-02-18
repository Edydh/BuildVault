import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Share,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  MediaItem,
  Project,
  ProjectPublicProfile,
  getMediaByProject,
  getProjectById,
  getProjectPublicProfile,
} from '../../../lib/db';
import {
  ProjectVisibilityFeedSyncSummary,
  setProjectVisibilityInSupabase,
  upsertProjectPublicProfileInSupabase,
} from '../../../lib/supabaseProjectsSync';
import { BVCard, BVHeader, BVButton } from '../../../components/ui';
import { GlassTextInput } from '../../../components/glass';
import { bvColors, bvFx } from '../../../lib/theme/tokens';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseHighlights(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
}

function parseProfileHighlights(profile: ProjectPublicProfile | null): string {
  if (!profile?.highlights_json) return '';
  try {
    const parsed = JSON.parse(profile.highlights_json);
    if (!Array.isArray(parsed)) return '';
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 8)
      .join('\n');
  } catch {
    return '';
  }
}

function buildPublicUrl(slugValue: string): string {
  const normalizedSlug = slugify(slugValue);
  const baseUrl = process.env.EXPO_PUBLIC_PUBLIC_WEB_URL?.trim();
  if (baseUrl) {
    return `${baseUrl.replace(/\/+$/, '')}/public/${encodeURIComponent(normalizedSlug)}`;
  }
  return `buildvault://public/${encodeURIComponent(normalizedSlug)}`;
}

type SyncBanner = {
  tone: 'success' | 'neutral';
  title: string;
  detail: string;
};

function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

function buildSyncBanner(sync: ProjectVisibilityFeedSyncSummary): SyncBanner {
  if (sync.visibility === 'private') {
    if (sync.unpublished > 0) {
      return {
        tone: 'success',
        title: `${sync.unpublished} ${pluralize(sync.unpublished, 'media post')} hidden from Feed`,
        detail: `${sync.totalMedia} ${pluralize(sync.totalMedia, 'published item')} were checked.`,
      };
    }
    return {
      tone: 'neutral',
      title: 'No published media to hide',
      detail: 'Feed visibility is already in sync for this project.',
    };
  }

  const activatedCount = sync.inserted + sync.republished;
  if (activatedCount > 0) {
    const parts: string[] = [];
    if (sync.inserted > 0) {
      parts.push(`${sync.inserted} new`);
    }
    if (sync.republished > 0) {
      parts.push(`${sync.republished} republished`);
    }
    if (sync.updatedPublished > 0) {
      parts.push(`${sync.updatedPublished} refreshed`);
    }
    if (sync.skippedRemoved > 0) {
      parts.push(`${sync.skippedRemoved} removed skipped`);
    }

    return {
      tone: 'success',
      title: `${activatedCount} ${pluralize(activatedCount, 'media post')} synced to Feed`,
      detail: `${sync.totalMedia} scanned${parts.length > 0 ? ` (${parts.join(' • ')})` : ''}.`,
    };
  }

  return {
    tone: 'neutral',
    title: 'Feed already up to date',
    detail: `${sync.totalMedia} ${pluralize(sync.totalMedia, 'media item')} scanned${
      sync.skippedRemoved > 0 ? ` (${sync.skippedRemoved} removed skipped)` : ''
    }.`,
  };
}

export default function ProjectPublicSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [projectMedia, setProjectMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isPublic, setIsPublic] = useState(false);
  const [slug, setSlug] = useState('');
  const [publicTitle, setPublicTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [heroComment, setHeroComment] = useState('');
  const [heroMediaId, setHeroMediaId] = useState<string | null>(null);
  const [syncBanner, setSyncBanner] = useState<SyncBanner | null>(null);
  const visibilityDraftRef = useRef(false);

  const applyVisibilityDraft = (value: boolean) => {
    visibilityDraftRef.current = value;
    setIsPublic(value);
  };

  const photoAndVideoMedia = useMemo(
    () => projectMedia.filter((item) => item.type === 'photo' || item.type === 'video'),
    [projectMedia]
  );

  const readiness = useMemo(() => {
    const effectiveTitle = (publicTitle.trim() || project?.name || '').trim();
    const effectiveSlug = slugify(slug || project?.name || '');
    const checks = {
      slug: effectiveSlug.length > 0,
      title: effectiveTitle.length > 0,
      summary: summary.trim().length > 0,
      location: city.trim().length > 0 || region.trim().length > 0,
      heroMedia: !!heroMediaId && photoAndVideoMedia.some((item) => item.id === heroMediaId),
    };
    const missing: string[] = [];
    if (!checks.slug) missing.push('public slug');
    if (!checks.title) missing.push('public title');
    if (!checks.summary) missing.push('summary');
    if (!checks.location) missing.push('city or region');
    if (!checks.heroMedia) missing.push('hero media');

    return {
      checks,
      missing,
      ready: Object.values(checks).every(Boolean),
      effectiveSlug,
    };
  }, [city, heroMediaId, photoAndVideoMedia, project?.name, publicTitle, region, slug, summary]);

  const loadData = useCallback(() => {
    if (!id) return;

    try {
      const projectRecord = getProjectById(id);
      if (!projectRecord) {
        Alert.alert('Error', 'Project not found');
        router.back();
        return;
      }

      const media = getMediaByProject(id);
      const publicProfile = getProjectPublicProfile(id);

      setProject(projectRecord);
      setProjectMedia(media);
      applyVisibilityDraft(projectRecord.visibility === 'public');
      setSlug(projectRecord.public_slug || slugify(projectRecord.name));
      setPublicTitle(publicProfile?.public_title || projectRecord.name);
      setSummary(publicProfile?.summary || '');
      setCity(publicProfile?.city || '');
      setRegion(publicProfile?.region || '');
      setCategory(publicProfile?.category || '');
      setContactEmail(publicProfile?.contact_email || '');
      setContactPhone(publicProfile?.contact_phone || '');
      setWebsiteUrl(publicProfile?.website_url || '');
      setHighlightsText(parseProfileHighlights(publicProfile));
      setHeroComment(publicProfile?.hero_comment || '');
      setSyncBanner(null);

      const existingHero = publicProfile?.hero_media_id || null;
      const fallbackHero = media.find((item) => item.type === 'photo' || item.type === 'video')?.id ?? null;
      setHeroMediaId(existingHero || fallbackHero);
    } catch (error) {
      console.error('Error loading public project settings:', error);
      Alert.alert('Error', 'Could not load public settings.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    if (!id || !project) return;
    const shouldPublish = visibilityDraftRef.current;

    const normalizedSlug = slugify(slug || project.name);
    if (shouldPublish && !readiness.ready) {
      Alert.alert(
        'Project not ready to publish',
        `Please complete: ${readiness.missing.join(', ')}.`
      );
      return;
    }

    try {
      setSaving(true);

      await upsertProjectPublicProfileInSupabase(id, {
        public_title: publicTitle.trim() || project.name,
        summary: summary.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        category: category.trim() || null,
        hero_media_id: heroMediaId,
        hero_comment: heroComment.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        website_url: websiteUrl.trim() || null,
        highlights: parseHighlights(highlightsText),
      });

      const visibilityResult = await setProjectVisibilityInSupabase(id, shouldPublish ? 'public' : 'private', {
        slug: shouldPublish ? normalizedSlug : undefined,
      });
      const updated = visibilityResult.project;

      setProject(updated);
      applyVisibilityDraft(updated.visibility === 'public');
      setSyncBanner(buildSyncBanner(visibilityResult.sync));
      if (updated.public_slug) {
        setSlug(updated.public_slug);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Saved',
        shouldPublish
          ? 'Project is now public with updated profile info.'
          : 'Project is private. Public profile is saved for later.'
      );
    } catch (error) {
      console.error('Error saving public settings:', error);
      const message = error instanceof Error ? error.message : 'Could not save public settings. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (!id || !project) return;
    if (!readiness.ready) {
      Alert.alert('Project not ready', `Please complete: ${readiness.missing.join(', ')}.`);
      return;
    }

    const normalizedSlug = slugify(slug || project.name);
    try {
      setSaving(true);
      await upsertProjectPublicProfileInSupabase(id, {
        public_title: publicTitle.trim() || project.name,
        summary: summary.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        category: category.trim() || null,
        hero_media_id: heroMediaId,
        hero_comment: heroComment.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        website_url: websiteUrl.trim() || null,
        highlights: parseHighlights(highlightsText),
      });
      const visibilityResult = await setProjectVisibilityInSupabase(id, 'public', {
        slug: normalizedSlug,
      });
      const updated = visibilityResult.project;
      setProject(updated);
      applyVisibilityDraft(true);
      setSyncBanner(buildSyncBanner(visibilityResult.sync));
      if (updated.public_slug) {
        setSlug(updated.public_slug);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Published', 'Project is now public and visible in Feed.');
    } catch (error) {
      console.error('Error publishing project:', error);
      const message = error instanceof Error ? error.message : 'Could not publish this project yet.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!id || !project) return;
    try {
      setSaving(true);
      const visibilityResult = await setProjectVisibilityInSupabase(id, 'private');
      const updated = visibilityResult.project;
      setProject(updated);
      applyVisibilityDraft(false);
      setSyncBanner(buildSyncBanner(visibilityResult.sync));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Unpublished', 'Project is now private.');
    } catch (error) {
      console.error('Error unpublishing project:', error);
      Alert.alert('Error', 'Could not unpublish this project.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewLivePage = () => {
    if (!project) return;
    if (project.visibility !== 'public' || !project.public_slug) {
      Alert.alert(
        'Not published yet',
        'This project must be published before live preview works.',
        readiness.ready
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Publish Now', onPress: () => handlePublishNow() },
            ]
          : [{ text: 'OK' }]
      );
      return;
    }
    router.push({
      pathname: '/public/[slug]',
      params: { slug: project.public_slug },
    });
  };

  const handleCopyPublicLink = async () => {
    const slugCandidate = slugify(project?.public_slug || slug || project?.name || '');
    if (!slugCandidate) {
      Alert.alert('Missing slug', 'Please set a valid slug first.');
      return;
    }

    const publicLink = buildPublicUrl(slugCandidate);
    try {
      Clipboard.setString(publicLink);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Link Copied',
        project?.visibility === 'public'
          ? 'Public link copied to clipboard.'
          : 'Draft link copied. Publish this project to make it publicly accessible.'
      );
    } catch (error) {
      console.warn('Clipboard copy failed, falling back to share:', error);
      try {
        await Share.share({
          message: publicLink,
          url: publicLink,
        });
      } catch (shareError) {
        console.error('Share fallback failed:', shareError);
        Alert.alert('Could not copy link', publicLink);
      }
    }
  };

  if (loading || !project) {
    return (
      <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: bvColors.text.muted }}>Loading public settings...</Text>
      </View>
    );
  }

  const publicUrlPreview = buildPublicUrl(slug || project.name);
  const selectedHero = photoAndVideoMedia.find((item) => item.id === heroMediaId) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
      <BVHeader
        title="Public Profile"
        subtitle={project.name}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <BVCard style={{ marginTop: 8, marginBottom: 12 }} contentStyle={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700' }}>
                Public Visibility
              </Text>
              <Text style={{ color: bvColors.text.muted, fontSize: 13, marginTop: 4 }}>
                {isPublic
                  ? 'This project can appear in Feed and be opened by public slug.'
                  : 'Project is private. You can still prepare the public profile now.'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const next = !visibilityDraftRef.current;
                applyVisibilityDraft(next);
              }}
              style={{
                width: 68,
                height: 36,
                borderRadius: 18,
                backgroundColor: isPublic ? bvColors.brand.primaryLight : bvColors.surface.muted,
                padding: 3,
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: bvColors.neutral[0],
                  alignSelf: isPublic ? 'flex-end' : 'flex-start',
                }}
              />
            </TouchableOpacity>
          </View>
          <Text style={{ color: bvColors.text.tertiary, fontSize: 12, marginTop: 10 }}>
            URL preview: {publicUrlPreview}
          </Text>
        </BVCard>

        <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
          <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700' }}>
            Publication
          </Text>
          <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 4 }}>
            Status: {project.visibility === 'public' ? 'Published' : 'Private'}
          </Text>
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
            {project.visibility === 'public' ? (
              <BVButton
                title="Unpublish"
                onPress={handleUnpublish}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={saving}
              />
            ) : (
              <BVButton
                title="Publish Now"
                onPress={handlePublishNow}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={saving || !readiness.ready}
              />
            )}
          </View>
        </BVCard>

        {syncBanner ? (
          <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={syncBanner.tone === 'success' ? 'checkmark-circle' : 'information-circle'}
                size={18}
                color={syncBanner.tone === 'success' ? bvColors.semantic.success : bvColors.text.secondary}
              />
              <Text
                style={{
                  color: bvColors.text.primary,
                  fontSize: 14,
                  fontWeight: '700',
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {syncBanner.title}
              </Text>
            </View>
            <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 8 }}>
              {syncBanner.detail}
            </Text>
          </BVCard>
        ) : null}

        <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
          <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700' }}>
            Publish Checklist
          </Text>
          <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 4, marginBottom: 10 }}>
            Required before a project can be public.
          </Text>

          {[
            { key: 'title', label: 'Public title', pass: readiness.checks.title },
            { key: 'summary', label: 'Summary', pass: readiness.checks.summary },
            { key: 'location', label: 'City or region', pass: readiness.checks.location },
            { key: 'hero', label: 'Hero media', pass: readiness.checks.heroMedia },
            { key: 'slug', label: 'Public slug', pass: readiness.checks.slug },
          ].map((item) => (
            <View
              key={item.key}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
            >
              <Ionicons
                name={item.pass ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={item.pass ? bvColors.semantic.success : bvColors.text.tertiary}
              />
              <Text style={{ color: bvColors.text.secondary, marginLeft: 8, fontSize: 13 }}>
                {item.label}
              </Text>
            </View>
          ))}

          <Text
            style={{
              color: readiness.ready ? bvColors.semantic.success : bvColors.semantic.warning,
              fontSize: 12,
              marginTop: 4,
              fontWeight: '600',
            }}
          >
            {readiness.ready ? 'Ready to publish' : `Missing: ${readiness.missing.join(', ')}`}
          </Text>
        </BVCard>

        <GlassTextInput
          label="Public Slug"
          value={slug}
          onChangeText={setSlug}
          placeholder="e.g. downtown-office-complex"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <GlassTextInput
          label="Public Title"
          value={publicTitle}
          onChangeText={setPublicTitle}
          placeholder="Displayed title for public feed"
        />

        <GlassTextInput
          label="Summary"
          value={summary}
          onChangeText={setSummary}
          placeholder="High-level project summary (no sensitive details)"
          multiline
          numberOfLines={4}
          inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <GlassTextInput
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="City"
            />
          </View>
          <View style={{ flex: 1 }}>
            <GlassTextInput
              label="Region / State"
              value={region}
              onChangeText={setRegion}
              placeholder="State / Region"
            />
          </View>
        </View>

        <GlassTextInput
          label="Category"
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Residential Renovation"
        />

        <GlassTextInput
          label="Contact Email (Optional)"
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="public-contact@company.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <GlassTextInput
          label="Contact Phone (Optional)"
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="+1 555 123 4567"
          keyboardType="phone-pad"
        />

        <GlassTextInput
          label="Website URL (Optional)"
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          placeholder="https://yourcompany.com"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <GlassTextInput
          label="Highlights (One Per Line)"
          value={highlightsText}
          onChangeText={setHighlightsText}
          placeholder={'Completed foundation phase\nLEED-ready materials\nOn-schedule delivery'}
          multiline
          numberOfLines={4}
          inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
        />

        <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 }}>
          Hero Media
        </Text>
        {photoAndVideoMedia.length === 0 ? (
          <BVCard contentStyle={{ padding: 14, marginBottom: 12 }}>
            <Text style={{ color: bvColors.text.muted, fontSize: 13 }}>
              Capture or upload photo/video first to select a public hero image.
            </Text>
          </BVCard>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 }}>
            {photoAndVideoMedia.slice(0, 8).map((item) => {
              const selected = item.id === heroMediaId;
              const previewUri = item.type === 'video' ? item.thumb_uri || item.uri : item.uri;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setHeroMediaId(item.id)}
                  activeOpacity={0.88}
                  style={{
                    width: '24%',
                    aspectRatio: 1,
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 8,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? bvColors.brand.primaryLight : bvFx.neutralBorder,
                    backgroundColor: bvColors.surface.muted,
                  }}
                >
                  <ExpoImage source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  {selected && (
                    <View
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: 4,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: bvColors.brand.primaryLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark" size={12} color={bvColors.neutral[0]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {selectedHero && (
          <BVCard contentStyle={{ padding: 12 }}>
            <Text style={{ color: bvColors.text.muted, fontSize: 12 }}>
              Selected hero: {selectedHero.type.toUpperCase()} • {new Date(selectedHero.created_at).toLocaleDateString()}
            </Text>
          </BVCard>
        )}

        <GlassTextInput
          label="Hero Media Public Comment"
          value={heroComment}
          onChangeText={setHeroComment}
          placeholder="Optional caption shown under the hero media in public view"
          multiline
          numberOfLines={3}
          inputStyle={{ minHeight: 78, textAlignVertical: 'top' }}
        />
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <BVButton
            title="Copy Link"
            onPress={handleCopyPublicLink}
            variant="secondary"
            style={{ flex: 1 }}
            icon="copy-outline"
          />
          <BVButton
            title="Preview Live"
            onPress={handlePreviewLivePage}
            variant="secondary"
            style={{ flex: 1 }}
            disabled={saving}
            icon="eye-outline"
          />
        </View>
        <BVButton
          title={saving ? 'Saving...' : isPublic ? 'Save Draft & Publish' : 'Save Draft (Private)'}
          onPress={handleSave}
          disabled={saving}
        />
      </View>
    </View>
  );
}
