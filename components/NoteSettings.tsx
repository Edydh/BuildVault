import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { GlassSwitch } from './glass';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NoteSettingsProps {
  onSettingsChange?: () => void;
}
 
export interface NoteSettings {
  showPrompts: boolean;
  showVisualIndicators: boolean;
  showQuickAdd: boolean;
  promptFrequency: 'always' | 'first_time' | 'never';
}

const DEFAULT_SETTINGS: NoteSettings = {
  showPrompts: true,
  showVisualIndicators: true,
  showQuickAdd: true,
  promptFrequency: 'first_time',
};

const STORAGE_KEY = 'note_encouragement_settings';

type NoteSettingsListener = (settings: NoteSettings) => void;

const noteSettingsListeners = new Set<NoteSettingsListener>();

export const subscribeToNoteSettings = (listener: NoteSettingsListener) => {
  noteSettingsListeners.add(listener);
  return () => {
    noteSettingsListeners.delete(listener);
  };
};

const notifyNoteSettingsListeners = (settings: NoteSettings) => {
  noteSettingsListeners.forEach((listener) => {
    try {
      listener(settings);
    } catch (error) {
      console.error('Error notifying note settings listener:', error);
    }
  });
};

export default function NoteSettings({ onSettingsChange }: NoteSettingsProps) {
  const [settings, setSettings] = useState<NoteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading note settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: NoteSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      onSettingsChange?.();
      notifyNoteSettingsListeners(newSettings);
    } catch (error) {
      console.error('Error saving note settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const updateSetting = <K extends keyof NoteSettings>(key: K, value: NoteSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const resetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all note encouragement settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => saveSettings(DEFAULT_SETTINGS),
        },
      ]
    );
  };

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  if (loading) {
    return (
      <View style={{
        backgroundColor: '#1F2A37',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
      }}>
        <Text style={{
          color: '#F8FAFC',
          fontSize: 16,
          textAlign: 'center',
        }}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <View style={{
      backgroundColor: '#1F2A37',
      borderRadius: 12,
      marginVertical: 8,
      overflow: 'hidden',
    }}>
      {/* Header - Always Visible */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
        }}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="document-text" size={24} color="#3B82F6" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{
              color: '#F8FAFC',
              fontSize: 18,
              fontWeight: 'bold',
            }}>
              Note Encouragement
            </Text>
            <Text style={{
              color: '#94A3B8',
              fontSize: 14,
              marginTop: 2,
            }}>
              Configure note-taking preferences
            </Text>
          </View>
        </View>
        <Animated.View
          style={{
            transform: [{
              rotate: animation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
              }),
            }],
          }}
        >
          <Ionicons name="chevron-down" size={20} color="#64748B" />
        </Animated.View>
      </TouchableOpacity>

      {/* Expandable Content */}
      <Animated.View
        style={{
          maxHeight: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1000], // Large enough to accommodate all content
          }),
          opacity: animation,
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{
            color: '#94A3B8',
            fontSize: 14,
            marginBottom: 20,
            lineHeight: 20,
          }}>
            Configure how the app encourages you to add notes to your media for better searchability.
          </Text>

      {/* Settings */}
      <View style={{ marginBottom: 20 }}>
        {/* Show Prompts */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: '#F8FAFC',
              fontSize: 16,
              fontWeight: '600',
            }}>
              Show Note Prompts
            </Text>
            <Text style={{
              color: '#94A3B8',
              fontSize: 14,
              marginTop: 2,
            }}>
              Display prompts when opening media without notes
            </Text>
          </View>
          <GlassSwitch
            value={settings.showPrompts}
            onValueChange={(value) => updateSetting('showPrompts', value)}
          />
        </View>

        {/* Visual Indicators */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: '#F8FAFC',
              fontSize: 16,
              fontWeight: '600',
            }}>
              Visual Indicators
            </Text>
            <Text style={{
              color: '#94A3B8',
              fontSize: 14,
              marginTop: 2,
            }}>
              Show pulsing "Add Note" buttons on media without notes
            </Text>
          </View>
          <GlassSwitch
            value={settings.showVisualIndicators}
            onValueChange={(value) => updateSetting('showVisualIndicators', value)}
          />
        </View>

        {/* Quick Add */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: '#F8FAFC',
              fontSize: 16,
              fontWeight: '600',
            }}>
              Quick Add Suggestions
            </Text>
            <Text style={{
              color: '#94A3B8',
              fontSize: 14,
              marginTop: 2,
            }}>
              Show suggested notes when adding notes to media
            </Text>
          </View>
          <GlassSwitch
            value={settings.showQuickAdd}
            onValueChange={(value) => updateSetting('showQuickAdd', value)}
          />
        </View>

        {/* Prompt Frequency */}
        <View style={{
          marginBottom: 16,
        }}>
          <Text style={{
            color: '#F8FAFC',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 8,
          }}>
            Prompt Frequency
          </Text>
          <Text style={{
            color: '#94A3B8',
            fontSize: 14,
            marginBottom: 12,
          }}>
            How often to show note prompts
          </Text>
          
          {(
            [
              { key: 'always', label: 'Always', description: 'Show prompts every time' },
              { key: 'first_time', label: 'First Time Only', description: 'Show only for new media' },
              { key: 'never', label: 'Never', description: 'Disable all prompts' },
            ] as const
          ).map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => updateSetting('promptFrequency', option.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: settings.promptFrequency === option.key ? '#374151' : 'transparent',
                marginBottom: 4,
              }}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: settings.promptFrequency === option.key ? '#3B82F6' : '#6B7280',
                backgroundColor: settings.promptFrequency === option.key ? '#3B82F6' : 'transparent',
                marginRight: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {settings.promptFrequency === option.key && (
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#FFFFFF',
                  }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: '#F8FAFC',
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  {option.label}
                </Text>
                <Text style={{
                  color: '#94A3B8',
                  fontSize: 12,
                }}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reset Button */}
      <TouchableOpacity
        onPress={resetSettings}
        style={{
          backgroundColor: '#374151',
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="refresh" size={16} color="#F59E0B" />
        <Text style={{
          color: '#F59E0B',
          fontSize: 14,
          fontWeight: '600',
          marginLeft: 8,
        }}>
          Reset to Default
        </Text>
      </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// Helper functions for other components
export const getNoteSettings = async (): Promise<NoteSettings> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading note settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const shouldShowPrompt = async (mediaId: string): Promise<boolean> => {
  try {
    const settings = await getNoteSettings();
    if (!settings.showPrompts || settings.promptFrequency === 'never') {
      return false;
    }

    if (settings.promptFrequency === 'first_time') {
      const promptShown = await AsyncStorage.getItem(`prompt_shown_${mediaId}`);
      return !promptShown;
    }

    return true;
  } catch (error) {
    console.error('Error checking prompt settings:', error);
    return false;
  }
};

export const markPromptShown = async (mediaId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(`prompt_shown_${mediaId}`, 'true');
  } catch (error) {
    console.error('Error marking prompt as shown:', error);
  }
};
