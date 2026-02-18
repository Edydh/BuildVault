import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProjects } from '../../lib/db';
import { deleteProjectDir, clearAllProjectDirs } from '../../lib/files';
import { useAuth } from '../../lib/AuthContext';
import { deleteProjectInSupabase } from '../../lib/supabaseProjectsSync';
import NoteSettings from '../../components/NoteSettings';
import {
  useGlassTheme,
  GlassCard,
  GlassSwitch,
  GlassActionSheet,
  GlassModal,
  GlassTextInput,
  GlassButton,
  GLASS_THEME_STORAGE_KEY,
} from '../../components/glass';
import { BVHeader, BVCard, BVButton } from '../../components/ui';
import { bvColors, bvFx, bvRadius, bvSpacing, bvTypography } from '../../lib/theme/tokens';
import * as Haptics from 'expo-haptics';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, updateDisplayName } = useAuth();
  const glassTheme = useGlassTheme();
  type IoniconName = keyof typeof Ionicons.glyphMap;
  
  // Animation values for dynamic header
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  // Expandable Glass Effects state
  const [isGlassEffectsExpanded, setIsGlassEffectsExpanded] = useState(false);
  const glassEffectsHeight = useRef(new Animated.Value(0)).current;

  // Handle scroll events for dynamic header
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    try {
      const offsetY = event.nativeEvent.contentOffset.y;
      
      // Calculate opacity based on scroll position
      // Start fading at 50px, fully transparent at 150px
      const fadeStart = 50;
      const fadeEnd = 150;
      
      if (offsetY > fadeStart) {
        const progress = Math.min((offsetY - fadeStart) / (fadeEnd - fadeStart), 1);
        const opacity = Math.max(0, 1 - progress);
        
        headerOpacity.setValue(opacity);
      } else {
        headerOpacity.setValue(1);
      }
    } catch {
      // Fallback: keep header visible if there's an error
      headerOpacity.setValue(1);
    }
  };

  const [showDangerSheet, setShowDangerSheet] = React.useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = React.useState(false);
  const [showSuccessSheet, setShowSuccessSheet] = React.useState(false);
  const [showErrorSheet, setShowErrorSheet] = React.useState(false);
  const [sheetMessage, setSheetMessage] = React.useState('');
  const [showAboutSheet, setShowAboutSheet] = React.useState(false);
  const [preferDbFiltering, setPreferDbFiltering] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [profileNameDraft, setProfileNameDraft] = React.useState('');
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setProfileNameDraft(user.name);
  }, [user]);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatar]);

  // Load/save performance preference
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@buildvault/use-db-filtering');
        if (raw) setPreferDbFiltering(raw === 'true');
      } catch {}
    })();
  }, []);
  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('@buildvault/use-db-filtering', String(preferDbFiltering));
      } catch {}
    })();
  }, [preferDbFiltering]);
  const handleClearAllData = () => {
    setShowDangerSheet(true);
  };

  const performFullDataClear = async () => {
    try {
      const projects = getProjects();
      for (const project of projects) {
        await deleteProjectDir(project.id);
        await deleteProjectInSupabase(project.id);
      }

      await clearAllProjectDirs();

      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(key =>
          key === 'projectViewMode' ||
          key === 'note_encouragement_settings' ||
          key === GLASS_THEME_STORAGE_KEY ||
          key === '@buildvault/use-db-filtering' ||
          key === '@buildvault/project-filters' ||
          key.startsWith('prompt_shown_')
          || key.startsWith('@buildvault/media-filters/')
        );

        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
      } catch (storageError) {
        console.error('Error clearing local preferences:', storageError);
      }

      setSheetMessage('All projects and media have been deleted. Please restart the app to see changes.');
      setShowSuccessSheet(true);
    } catch (error) {
      console.error('Clear data error:', error);
      setSheetMessage('Failed to clear data. Please try again.');
      setShowErrorSheet(true);
    } finally {
      setShowDangerSheet(false);
    }
  };

  const handleAbout = () => {
    setShowAboutSheet(true);
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    destructive = false
  }: {
    icon: IoniconName;
    title: string;
    subtitle?: string;
    onPress: () => void;
    destructive?: boolean;
  }) => (
    <BVCard
      onPress={onPress}
      style={{ marginBottom: bvSpacing[12] }}
      contentStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: bvSpacing[16],
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: bvRadius.sm,
          backgroundColor: destructive ? bvFx.dangerTint : bvFx.brandSoftStrong,
          borderWidth: 1,
          borderColor: destructive ? bvFx.dangerBorder : bvFx.brandBorder,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: bvSpacing[16],
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? bvColors.semantic.danger : bvColors.brand.primaryLight}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...bvTypography.headingMedium,
            fontSize: 16,
            lineHeight: 20,
            color: destructive ? bvColors.semantic.dangerTint : bvColors.text.primary,
            marginBottom: subtitle ? 2 : 0,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={{ ...bvTypography.bodyRegular, color: bvColors.text.muted }}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={bvColors.neutral[500]} />
    </BVCard>
  );

  const handleSignOut = () => {
    setShowSignOutSheet(true);
  };

  const openProfileModal = () => {
    if (!user) return;
    setProfileNameDraft(user.name);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = profileNameDraft.trim();
    if (!trimmedName) {
      setSheetMessage('Display name cannot be empty.');
      setShowErrorSheet(true);
      return;
    }

    try {
      setIsSavingProfile(true);
      await updateDisplayName(trimmedName);
      setShowProfileModal(false);
      setSheetMessage('Profile updated. New activities will show this name.');
      setShowSuccessSheet(true);
    } catch (error) {
      console.error('Profile update error:', error);
      setSheetMessage('Failed to update profile. Please try again.');
      setShowErrorSheet(true);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Toggle Glass Effects expansion
  const toggleGlassEffects = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = isGlassEffectsExpanded ? 0 : 1;
    setIsGlassEffectsExpanded(!isGlassEffectsExpanded);
    
    Animated.timing(glassEffectsHeight, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.app }} pointerEvents="box-none">
      <StatusBar barStyle="light-content" backgroundColor={bvColors.surface.app} translucent />
      <Animated.View 
        style={{ 
          opacity: headerOpacity,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: bvColors.surface.app,
          pointerEvents: 'none',
        }}
      >
        <View style={{ pointerEvents: 'auto' }}>
          <BVHeader
            title="Settings"
            subtitle="App preferences and management"
            style={{
              backgroundColor: 'transparent',
            }}
          />
        </View>
      </Animated.View>

      <ScrollView 
        style={{ flex: 1, backgroundColor: bvColors.surface.app }}
        contentContainerStyle={{ 
          padding: 16,
          paddingTop: insets.top + 120, // Header height + safe area
          paddingBottom: insets.bottom + 20 
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
        bounces={true}
        scrollEnabled={true}
        alwaysBounceVertical={true}
      >

      {/* Glass Theme Section - Expandable */}
      <View style={{ paddingBottom: 8 }}>
        <Text style={{
          color: bvColors.text.tertiary,
          fontSize: 14,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 12,
        }}>
          Glass Effects
        </Text>
        
        <GlassCard style={{ marginBottom: 16, overflow: 'hidden' }}>
          {/* Header - Always Visible */}
          <TouchableOpacity
            onPress={toggleGlassEffects}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              paddingBottom: isGlassEffectsExpanded ? 12 : 16,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '600' }}>
                Glass Effects
              </Text>
              <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                {isGlassEffectsExpanded ? 'Tap to collapse' : 'Tap to expand settings'}
              </Text>
            </View>
            <Animated.View
              style={{
                transform: [{
                  rotate: glassEffectsHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  })
                }]
              }}
            >
              <Ionicons name="chevron-down" size={20} color={bvColors.text.tertiary} />
            </Animated.View>
          </TouchableOpacity>

          {/* Expandable Content */}
          <Animated.View
            style={{
              height: glassEffectsHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 560], // Expanded height accommodates extra toggles
              }),
              opacity: glassEffectsHeight,
            }}
          >
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {/* Blur Intensity */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                  Blur Intensity
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        glassTheme.updateConfig({ intensity: level });
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: glassTheme.config.intensity === level 
                          ? bvFx.accentSoft 
                          : bvFx.glassSoft,
                        borderWidth: 1,
                        borderColor: glassTheme.config.intensity === level 
                          ? bvColors.brand.accent 
                          : bvFx.glassBorderSoft,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ 
                        color: glassTheme.config.intensity === level ? bvColors.brand.accent : bvColors.text.muted,
                        fontSize: 14,
                        fontWeight: glassTheme.config.intensity === level ? '600' : '400',
                        textTransform: 'capitalize',
                      }}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Enable Animations */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Animations
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Smooth transitions and effects
                  </Text>
                </View>
                <GlassSwitch
                  value={glassTheme.config.enableAnimations}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    glassTheme.updateConfig({ enableAnimations: value });
                  }}
                />
              </View>

              {/* Enable Haptics */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Haptic Feedback
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Tactile responses on interactions
                  </Text>
                </View>
                <GlassSwitch
                  value={glassTheme.config.enableHaptics}
                  onValueChange={(value) => {
                    if (value) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    glassTheme.updateConfig({ enableHaptics: value });
                  }}
                />
              </View>

              {/* Reduce Transparency */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Reduce Transparency
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Better visibility on older devices
                  </Text>
                </View>
                <GlassSwitch
                  value={glassTheme.config.reduceTransparency}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    glassTheme.updateConfig({ reduceTransparency: value });
                  }}
                />
              </View>

              {/* Quick Performance Mode */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Reduced Effects (Performance)
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Low-overhead visuals for slower devices
                  </Text>
                </View>
                <GlassSwitch
                  value={glassTheme.config.quickPerformanceMode}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    glassTheme.updateConfig({ quickPerformanceMode: value });
                  }}
                />
              </View>

              {/* Feature Flags: Overlays */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Gallery Overlays
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Glass header and floating buttons in gallery
                  </Text>
                </View>
                <GlassSwitch
                  value={glassTheme.config.featureFlags.galleryOverlays}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    glassTheme.updateConfig({ 
                      featureFlags: { 
                        ...glassTheme.config.featureFlags, 
                        galleryOverlays: value 
                      } 
                    });
                  }}
                />
              </View>

              {/* Performance: Prefer DB Filtering */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Prefer DB Filtering
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Use SQLite queries for filters/sort on large lists
                  </Text>
                </View>
                <GlassSwitch
                  value={preferDbFiltering}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreferDbFiltering(value);
                  }}
                />
              </View>

              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: bvFx.glassBorderSoft,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Media Detail Overlays
                  </Text>
                  <Text style={{ color: bvColors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                    Glass header and floating buttons in media view
                  </Text>
                </View>
                <GlassSwitch
                  value={glassTheme.config.featureFlags.mediaDetailOverlays}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    glassTheme.updateConfig({ 
                      featureFlags: { 
                        ...glassTheme.config.featureFlags, 
                        mediaDetailOverlays: value 
                      } 
                    });
                  }}
                />
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert(
                    'Reset Glass Theme',
                    'This will restore all glass effects to their default settings.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: () => {
                          glassTheme.resetToDefaults();
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        },
                      },
                    ]
                  );
                }}
                style={{
                  marginTop: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: bvFx.dangerTint,
                  borderWidth: 1,
                  borderColor: bvFx.dangerBorder,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: bvColors.semantic.dangerStrong, fontSize: 14, fontWeight: '600' }}>
                  Reset to Defaults
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GlassCard>
      </View>

      {/* User Info Section */}
      {user && (
        <View style={{ paddingBottom: 8 }}>
          <Text style={{
            color: bvColors.text.tertiary,
            fontSize: 14,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}>
            Account
          </Text>
          
          <BVCard style={{ marginBottom: 16 }} contentStyle={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: bvFx.brandSoftStrong,
                borderWidth: 1,
                borderColor: bvFx.brandBorder,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
                overflow: 'hidden',
              }}>
                {user.avatar && !avatarLoadFailed ? (
                  <Image
                    source={{ uri: user.avatar }}
                    style={{ width: '100%', height: '100%' }}
                    onError={() => setAvatarLoadFailed(true)}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons 
                    name={user.provider === 'apple' ? 'logo-apple' : 'logo-google'} 
                    size={24} 
                    color={bvColors.brand.primaryLight}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '600' }}>
                  {user.name}
                </Text>
                <Text style={{ color: bvColors.text.secondary, fontSize: 14 }}>
                  {user.email}
                </Text>
                <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 2 }}>
                  Signed in with {user.provider === 'apple' ? 'Apple ID' : 'Google'}
                </Text>
              </View>
            </View>

            <Text
              style={{
                color: bvColors.text.muted,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              Activity attribution name: {user.name}
            </Text>

            <BVButton
              title="Edit Display Name"
              variant="secondary"
              icon="create-outline"
              onPress={openProfileModal}
              style={{ marginBottom: 10 }}
            />
            <BVButton
              title="Organization & Team"
              variant="secondary"
              icon="business-outline"
              onPress={() => router.push('/organization')}
              style={{ marginBottom: 10 }}
            />
            <BVButton
              title="Sign Out"
              variant="danger"
              icon="log-out-outline"
              onPress={handleSignOut}
            />
          </BVCard>
        </View>
      )}

      <View>
        <Text style={{
          color: bvColors.text.tertiary,
          fontSize: 14,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 12,
        }}>
          Data Management
        </Text>

        {/* Note Encouragement Settings */}
        <NoteSettings />

        <Text style={{
          color: bvColors.text.tertiary,
          fontSize: 14,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 12,
          marginTop: 24,
        }}>
          App Information
        </Text>

        <SettingItem
          icon="information-circle"
          title="About BuildVault"
          subtitle="Version 1.0.3"
          onPress={handleAbout}
        />

        <Text style={{
          color: bvColors.text.tertiary,
          fontSize: 14,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 12,
          marginTop: 24,
        }}>
          Danger Zone
        </Text>

        <SettingItem
          icon="trash"
          title="Clear All Data"
          subtitle="Delete all projects and media"
          onPress={handleClearAllData}
          destructive
        />
      </View>

      <View style={{ paddingBottom: 40 }}>
        <Text style={{
          color: bvColors.neutral[600],
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 18,
        }}>
          BuildVault - Construction Project Manager{'\n'}
          Built with ❤️ © 2025 uniQubit
        </Text>
      </View>
      </ScrollView>

      <GlassModal
        visible={showProfileModal}
        onRequestClose={() => {
          if (!isSavingProfile) {
            setShowProfileModal(false);
          }
        }}
      >
        <View style={{ padding: 20 }}>
          <Text
            style={{
              color: bvColors.text.primary,
              fontSize: 20,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Edit Display Name
          </Text>
          <Text
            style={{
              color: bvColors.text.muted,
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            This name is used on project activities you create.
          </Text>

          <GlassTextInput
            label="Display Name"
            value={profileNameDraft}
            onChangeText={setProfileNameDraft}
            placeholder="Enter your name"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSaveProfile}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <GlassButton
              title="Cancel"
              variant="secondary"
              onPress={() => setShowProfileModal(false)}
              disabled={isSavingProfile}
              style={{ flex: 1 }}
            />
            <GlassButton
              title={isSavingProfile ? 'Saving...' : 'Save'}
              variant="primary"
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </GlassModal>

      <GlassActionSheet
        visible={showDangerSheet}
        onClose={() => setShowDangerSheet(false)}
        title="Clear All Data"
        message={'This will delete all projects and media. This action cannot be undone.'}
        actions={[
          {
            label: 'Clear Everything',
            destructive: true,
            onPress: performFullDataClear,
          },
        ]}
      />
      <GlassActionSheet
        visible={showSignOutSheet}
        onClose={() => setShowSignOutSheet(false)}
        title="Sign Out"
        message={'Are you sure you want to sign out? You will need to sign in again to access your projects.'}
        actions={[
          {
            label: 'Sign Out',
            destructive: true,
            onPress: async () => {
              try {
                await signOut();
              } catch {
                setShowSignOutSheet(false);
                setSheetMessage('Failed to sign out. Please try again.');
                setShowErrorSheet(true);
              }
            },
          },
        ]}
      />
      
      {/* Success Action Sheet */}
      <GlassActionSheet
        visible={showSuccessSheet}
        onClose={() => setShowSuccessSheet(false)}
        title="Success"
        message={sheetMessage}
        actions={[
          {
            label: 'OK',
            onPress: () => setShowSuccessSheet(false),
          },
        ]}
      />
      
      {/* Error Action Sheet */}
      <GlassActionSheet
        visible={showErrorSheet}
        onClose={() => setShowErrorSheet(false)}
        title="Error"
        message={sheetMessage}
        actions={[
          {
            label: 'OK',
            onPress: () => setShowErrorSheet(false),
          },
        ]}
      />

      {/* About Sheet */}
      <GlassActionSheet
        visible={showAboutSheet}
        onClose={() => setShowAboutSheet(false)}
        title="About BuildVault"
        message={'BuildVault v1.0.3\n\nA comprehensive construction project management app for organizing projects, capturing media, and managing documentation.\n\n© 2025 uniQubit\nBuilt with React Native & Expo'}
        actions={[
          {
            label: 'OK',
            onPress: () => setShowAboutSheet(false),
          },
        ]}
      />
    </View>
  );
}
