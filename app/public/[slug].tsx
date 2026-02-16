import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { BVButton, BVCard, BVHeader, BVEmptyState } from '../../components/ui';
import { PublicProjectDetail, getPublicProjectBySlug } from '../../lib/db';
import { bvColors, bvFx } from '../../lib/theme/tokens';

export default function PublicProjectDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<PublicProjectDetail | null>(null);
  const [heroLoadFailed, setHeroLoadFailed] = useState(false);

  const loadDetail = useCallback(() => {
    if (!slug) return;
    try {
      const decoded = decodeURIComponent(slug);
      const detail = getPublicProjectBySlug(decoded);
      setProject(detail);
      setHeroLoadFailed(false);
    } catch (error) {
      console.error('Failed to load public project detail:', error);
      setProject(null);
      setHeroLoadFailed(false);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail])
  );

  const openLink = async (target: string) => {
    const supported = await Linking.canOpenURL(target);
    if (!supported) {
      Alert.alert('Unavailable', 'This contact method is not available on this device.');
      return;
    }
    await Linking.openURL(target);
  };

  const handleContact = () => {
    if (!project) return;
    if (project.contact_email) {
      openLink(`mailto:${project.contact_email}`);
      return;
    }
    if (project.contact_phone) {
      openLink(`tel:${project.contact_phone}`);
      return;
    }
    if (project.website_url) {
      openLink(project.website_url);
      return;
    }
    Alert.alert('No contact details', 'This public profile has no contact method yet.');
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: bvColors.text.muted }}>Loading public project...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
        <BVHeader title="Public Project" subtitle="Not found" onBack={() => router.back()} />
        <BVEmptyState
          title="Project not found"
          description="This public page may be private or unavailable."
          icon="alert-circle-outline"
          style={{ marginTop: 72 }}
        />
      </View>
    );
  }

  const locationLabel = [project.city, project.region].filter(Boolean).join(', ') || 'Location not specified';
  const hasContact = !!project.contact_email || !!project.contact_phone || !!project.website_url;
  const heroSource = !heroLoadFailed ? project.hero_thumb_uri || project.hero_uri : null;
  const statusTone =
    project.status === 'active'
      ? { backgroundColor: 'rgba(34, 197, 94, 0.14)', borderColor: 'rgba(34, 197, 94, 0.35)', textColor: '#4ADE80' }
      : project.status === 'delayed'
        ? { backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.35)', textColor: '#FBBF24' }
        : project.status === 'completed'
          ? { backgroundColor: bvFx.brandSoft, borderColor: bvFx.brandBorder, textColor: bvColors.brand.primaryLight }
          : { backgroundColor: bvFx.glassSoft, borderColor: bvFx.neutralBorder, textColor: bvColors.text.secondary };

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
      <BVHeader title={project.title} subtitle={project.organization_name || 'Public project'} onBack={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}>
        {heroSource ? (
          <ExpoImage
            source={{ uri: heroSource }}
            style={{
              width: '100%',
              height: 220,
              borderRadius: 16,
              backgroundColor: bvColors.surface.muted,
              marginBottom: 12,
            }}
            onError={() => setHeroLoadFailed(true)}
            contentFit="cover"
            transition={220}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 150,
              borderRadius: 16,
              backgroundColor: bvColors.surface.muted,
              borderWidth: 1,
              borderColor: bvFx.glassBorderSoft,
              marginBottom: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="image-outline" size={28} color={bvColors.text.tertiary} />
            <Text style={{ color: bvColors.text.muted, fontSize: 13, marginTop: 8 }}>
              Cover photo unavailable
            </Text>
          </View>
        )}

        <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: bvColors.text.primary, fontSize: 20, fontWeight: '700', flex: 1, marginRight: 10 }}>
              {project.title}
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
                {project.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {project.summary ? (
            <Text style={{ color: bvColors.text.secondary, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
              {project.summary}
            </Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: bvColors.text.muted, fontSize: 12 }}>Location</Text>
            <Text style={{ color: bvColors.text.primary, fontSize: 14, fontWeight: '600', marginTop: 2 }}>
              {locationLabel}
            </Text>
          </View>

          {project.category ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: bvColors.text.muted, fontSize: 12 }}>Category</Text>
              <Text style={{ color: bvColors.text.primary, fontSize: 14, fontWeight: '600', marginTop: 2 }}>
                {project.category}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: bvColors.text.muted, fontSize: 12 }}>{project.media_count} media published</Text>
            <Text style={{ color: bvColors.text.muted, fontSize: 12 }}>Progress {project.progress}%</Text>
          </View>
        </BVCard>

        {project.highlights && project.highlights.length > 0 ? (
          <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
            <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
              Highlights
            </Text>
            {project.highlights.map((item, index) => (
              <View key={`${item}-${index}`} style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color={bvColors.semantic.success} style={{ marginTop: 1 }} />
                <Text style={{ color: bvColors.text.secondary, marginLeft: 8, flex: 1, lineHeight: 20 }}>
                  {item}
                </Text>
              </View>
            ))}
          </BVCard>
        ) : null}

        <BVCard contentStyle={{ padding: 14 }}>
          <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Contact
          </Text>
          {project.contact_email ? (
            <Text style={{ color: bvColors.text.secondary, fontSize: 14, marginBottom: 4 }}>
              Email: {project.contact_email}
            </Text>
          ) : null}
          {project.contact_phone ? (
            <Text style={{ color: bvColors.text.secondary, fontSize: 14, marginBottom: 4 }}>
              Phone: {project.contact_phone}
            </Text>
          ) : null}
          {project.website_url ? (
            <Text style={{ color: bvColors.text.secondary, fontSize: 14, marginBottom: 4 }}>
              Web: {project.website_url}
            </Text>
          ) : null}
          {!hasContact ? (
            <Text style={{ color: bvColors.text.muted, fontSize: 13 }}>
              Contact details are not available yet. Follow this profile for project updates.
            </Text>
          ) : null}
        </BVCard>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
        }}
      >
        <BVButton
          title={hasContact ? 'Get In Touch' : 'No Contact Available'}
          onPress={hasContact ? handleContact : undefined}
          disabled={!hasContact}
          icon={hasContact ? 'chatbubble-ellipses-outline' : undefined}
        />
      </View>
    </View>
  );
}
