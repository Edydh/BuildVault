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
        top: insets.top + 10, // Position below status bar with safe area
        right: 8,
        zIndex: 10,
      }}>
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
        }}>
          <TouchableOpacity
            onPress={handleAddNotePress}
            style={{
              backgroundColor: '#F59E0B',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
            }}
          >
            <Ionicons name="add-circle" size={16} color="#FFFFFF" />
            <Text style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: '600',
              marginLeft: 4,
            }}>
              Add Note
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // If media has a note, don't show any indicator
  return null;

}