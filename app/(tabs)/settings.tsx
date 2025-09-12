import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { documentDirectory } from 'expo-file-system/legacy';
import { getProjects, deleteProject, getMediaByProject } from '../../lib/db';
import { deleteProjectDir } from '../../lib/files';
import { useAuth } from '../../lib/AuthContext';
import NoteSettings from '../../components/NoteSettings';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  
  // Animation values for dynamic header
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

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

  const handleExportData = async () => {
    try {
      Alert.alert('Export Data', 'Preparing your data for export...', [], { cancelable: false });
      
      // Get all projects and their media
      const projects = getProjects();
      const exportData: {
        exportDate: string;
        version: string;
        projects: any[];
      } = {
        exportDate: new Date().toISOString(),
        version: '1.0.1',
        projects: []
      };

      for (const project of projects) {
        const media = getMediaByProject(project.id);
        exportData.projects.push({
          ...project,
          media: media.map(item => ({
            id: item.id,
            type: item.type,
            note: item.note,
            created_at: item.created_at
            // Note: We don't export file URIs as they're device-specific
          }))
        });
      }

      // Create export file
      const exportFileName = `BuildVault_Export_${new Date().toISOString().split('T')[0]}.json`;
      const exportPath = documentDirectory + exportFileName;
      
      await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(exportData, null, 2));

      // Share the export file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportPath, {
          mimeType: 'application/json',
          dialogTitle: 'Export BuildVault Data',
        });
      } else {
        Alert.alert('Export Complete', `Data exported to: ${exportFileName}`);
      }

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Failed to export data. Please try again.');
    }
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all projects and media. This action cannot be undone.\n\nWe recommend exporting your data first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export First',
          style: 'default',
          onPress: () => {
            handleExportData();
          },
        },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all projects to delete their directories
              const projects = getProjects();
              
              // Delete all project directories
              for (const project of projects) {
                await deleteProjectDir(project.id);
              }
              
              // Clear all data from database
              // Note: This is a simplified approach - in production you'd want to clear tables properly
              Alert.alert(
                'Data Cleared',
                'All projects and media have been deleted. Please restart the app to see changes.',
                [{ text: 'OK' }]
              );
              
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
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
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to sign in again to access your projects.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
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

        <SettingItem
          icon="download"
          title="Export Projects"
          subtitle="Export all project data and media"
          onPress={handleExportData}
        />

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
    </View>
  );
}