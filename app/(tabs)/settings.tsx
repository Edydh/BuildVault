import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProjects, deleteProject } from '../../lib/db';
import { deleteProjectDir, clearAllProjectDirs } from '../../lib/files';
import { useAuth } from '../../lib/AuthContext';
import NoteSettings from '../../components/NoteSettings';
import { useGlassTheme, GlassCard, GlassSwitch, GlassActionSheet, GLASS_THEME_STORAGE_KEY } from '../../components/glass';
import * as Haptics from 'expo-haptics';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const glassTheme = useGlassTheme();
  
  // Animation values for dynamic header
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  // Expandable Glass Effects state
  const [isGlassEffectsExpanded, setIsGlassEffectsExpanded] = useState(false);
  const glassEffectsHeight = useRef(new Animated.Value(0)).current;

  // Handle scroll events for dynamic header
  const handleScroll = (event: any) => {
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
    } catch (error) {
      // Fallback: keep header visible if there's an error
      headerOpacity.setValue(1);
    }
  };

  const [showDangerSheet, setShowDangerSheet] = React.useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = React.useState(false);
  const [showSuccessSheet, setShowSuccessSheet] = React.useState(false);
  const [showErrorSheet, setShowErrorSheet] = React.useState(false);
  const [sheetMessage, setSheetMessage] = React.useState('');
  const handleClearAllData = () => {
    setShowDangerSheet(true);
  };

  const performFullDataClear = async () => {
    try {
      const projects = getProjects();
      for (const project of projects) {
        await deleteProjectDir(project.id);
        deleteProject(project.id);
      }

      await clearAllProjectDirs();

      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(key =>
          key === 'projectViewMode' ||
          key === 'note_encouragement_settings' ||
          key === GLASS_THEME_STORAGE_KEY ||
          key.startsWith('prompt_shown_')
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
    Alert.alert(
      'About BuildVault',
      'BuildVault v1.0.1\n\nA comprehensive construction project management app for organizing projects, capturing media, and managing documentation.\n\n© 2025 uniQubit\nBuilt with React Native & Expo',
      [{ text: 'OK' }]
    );
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    destructive = false
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      style={{
        backgroundColor: '#101826',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1F2A37',
        flexDirection: 'row',
        alignItems: 'center',
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: destructive ? '#DC2626' : '#FF7A1A',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
      }}>
        <Ionicons
          name={icon as any}
          size={20}
          color="#0B0F14"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          color: destructive ? '#F87171' : '#F8FAFC',
          fontSize: 16,
          fontWeight: '600',
          marginBottom: subtitle ? 2 : 0,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: '#64748B', fontSize: 14 }}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748B" />
    </TouchableOpacity>
  );

  const handleSignOut = () => {
    setShowSignOutSheet(true);
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
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }} pointerEvents="box-none">
      <StatusBar barStyle="light-content" backgroundColor="#0B0F14" translucent />
      <Animated.View 
        style={{ 
          padding: 16, 
          paddingTop: insets.top + 16, 
          paddingBottom: 20,
          opacity: headerOpacity,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#0B0F14',
          pointerEvents: 'none',
        }}
      >
        <View style={{ pointerEvents: 'auto' }}>
          <Text style={{ color: '#F8FAFC', fontSize: 28, fontWeight: 'bold' }}>
            Settings
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, marginTop: 4 }}>
            App preferences and management
          </Text>
        </View>
      </Animated.View>

      <ScrollView 
        style={{ flex: 1, backgroundColor: '#0B0F14' }}
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
          color: '#64748B',
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
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
                Glass Effects
              </Text>
              <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
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
              <Ionicons name="chevron-down" size={20} color="#64748B" />
            </Animated.View>
          </TouchableOpacity>

          {/* Expandable Content */}
          <Animated.View
            style={{
              height: glassEffectsHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 400], // Approximate height when expanded
              }),
              opacity: glassEffectsHeight,
            }}
          >
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {/* Blur Intensity */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
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
                          ? 'rgba(255, 122, 26, 0.2)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: glassTheme.config.intensity === level 
                          ? '#FF7A1A' 
                          : 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ 
                        color: glassTheme.config.intensity === level ? '#FF7A1A' : '#94A3B8',
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
                borderTopColor: 'rgba(255, 255, 255, 0.1)',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '500' }}>
                    Animations
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
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
                borderTopColor: 'rgba(255, 255, 255, 0.1)',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '500' }}>
                    Haptic Feedback
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
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
                borderTopColor: 'rgba(255, 255, 255, 0.1)',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '500' }}>
                    Reduce Transparency
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
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
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>
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
            color: '#64748B',
            fontSize: 14,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}>
            Account
          </Text>
          
          <View style={{
            backgroundColor: '#101826',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#FF7A1A',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons 
                  name={user.provider === 'apple' ? 'logo-apple' : 'logo-google'} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
                  {user.name}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 14 }}>
                  {user.email}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                  Signed in with {user.provider === 'apple' ? 'Apple ID' : 'Google'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={{
                backgroundColor: '#1E293B',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View>
        <Text style={{
          color: '#64748B',
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
          color: '#64748B',
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
          subtitle="Version 1.0.1"
          onPress={handleAbout}
        />

        <Text style={{
          color: '#64748B',
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
          color: '#475569',
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 18,
        }}>
          BuildVault - Construction Project Manager{'\n'}
          Built with ❤️ © 2025 uniQubit
        </Text>
      </View>
      </ScrollView>

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
              } catch (error) {
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
    </View>
  );
}
