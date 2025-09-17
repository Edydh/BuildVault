import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from './glass';

interface NoteEncouragementProps {
  mediaId: string;
  hasNote: boolean;
  mediaType: 'photo' | 'video' | 'doc';
  onAddNotePress?: () => void;
}

export default function NoteEncouragement({
  mediaId,
  hasNote,
  mediaType,
  onAddNotePress,
}: NoteEncouragementProps) {
  const [pulseAnim] = useState(new Animated.Value(1));
  const insets = useSafeAreaInsets();

  // Pulse animation for visual indicator
  useEffect(() => {
    if (!hasNote) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [hasNote]);

  const handleAddNotePress = () => {
    // Navigate to media detail view instead of showing modal
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddNotePress?.();
  };

  // Visual indicator for media without notes
  if (!hasNote) {
    return (
      <View style={{
        position: 'absolute',
        top: 8, // Position relative to card, not status bar
        right: 8,
        zIndex: 20, // Higher z-index to appear above video overlays
      }}>
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
        }}>
          <GlassCard
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.3)',
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.6)',
            }}
            intensity={60}
            shadowEnabled={true}
          >
            <TouchableOpacity
              onPress={handleAddNotePress}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="add-circle" size={16} color="#F59E0B" />
              <Text style={{
                color: '#F59E0B',
                fontSize: 12,
                fontWeight: '600',
                marginLeft: 4,
              }}>
                Add Note
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </Animated.View>
      </View>
    );
  }

  // If media has a note, don't show any indicator
  return null;

}