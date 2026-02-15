import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassModal, GlassButton, GlassCard } from './glass';

interface NotePromptProps {
  visible: boolean;
  mediaType: 'photo' | 'video' | 'doc';
  onAddNote: () => void;
  onDismiss: () => void;
  onNeverShowAgain: () => void;
}

type IoniconName = keyof typeof Ionicons.glyphMap;
type MediaTypeInfo = {
  icon: IoniconName;
  title: string;
  description: string;
  benefits: string[];
};

export default function NotePrompt({
  visible,
  mediaType,
  onAddNote,
  onDismiss,
  onNeverShowAgain,
}: NotePromptProps) {
  const [slideAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Pulse animation for the note icon
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
      };
    } else {
      slideAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [visible, slideAnim, pulseAnim]);

  const handleAddNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddNote();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  const handleNeverShow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNeverShowAgain();
  };

  const getMediaTypeInfo = (): MediaTypeInfo => {
    switch (mediaType) {
      case 'photo':
        return {
          icon: 'camera',
          title: 'Photo without note',
          description: 'Adding a note to this photo will help you find it later when searching.',
          benefits: [
            'Find photos by what they show',
            'Remember important details',
            'Track progress over time',
          ],
        };
      case 'video':
        return {
          icon: 'videocam',
          title: 'Video without note',
          description: 'Adding a note to this video will help you find it later when searching.',
          benefits: [
            'Find videos by content',
            'Document processes',
            'Track important moments',
          ],
        };
      case 'doc':
        return {
          icon: 'document',
          title: 'Document without note',
          description: 'Adding a note to this document will help you find it later when searching.',
          benefits: [
            'Find documents by purpose',
            'Categorize by type',
            'Track document status',
          ],
        };
    }
  };

  const mediaInfo = getMediaTypeInfo();

  if (!visible) return null;

  return (
    <GlassModal
      visible={visible}
      onRequestClose={handleDismiss}
      contentStyle={styles.modalCard}
    >
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
            opacity: slideAnim,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.iconPill}>
              <Ionicons name={mediaInfo.icon} size={22} color="#3B82F6" />
            </View>
          </Animated.View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{mediaInfo.title}</Text>
            <Text style={styles.subtitle}>Help improve searchability</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{mediaInfo.description}</Text>

        {/* Benefits */}
        <GlassCard style={styles.benefitsCard} intensity={70} shadowEnabled={false}>
          <Text style={styles.benefitsTitle}>Benefits of adding notes</Text>
          {mediaInfo.benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </GlassCard>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <GlassButton
            title="Add Note"
            icon="add-circle"
            variant="primary"
            fullWidth
            onPress={handleAddNote}
            style={styles.primaryButton}
            haptic={false}
          />
          <GlassButton
            title="Maybe Later"
            variant="secondary"
            fullWidth
            onPress={handleDismiss}
            style={styles.secondaryButton}
            haptic={false}
          />
        </View>

        {/* Never show again option */}
        <TouchableOpacity onPress={handleNeverShow} style={styles.neverShowButton}>
          <Text style={styles.neverShowText}>Don't show this again</Text>
        </TouchableOpacity>
      </Animated.View>
    </GlassModal>
  );
}

const styles = StyleSheet.create({
  modalCard: {
    paddingVertical: 28,
    paddingHorizontal: 28,
    maxWidth: 420,
  },
  animatedContainer: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  description: {
    color: '#E2E8F0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  benefitsCard: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderRadius: 14,
  },
  benefitsTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    color: '#CBD5F5',
    fontSize: 14,
    marginLeft: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    marginRight: 8,
  },
  secondaryButton: {
    flex: 1,
    marginLeft: 8,
  },
  neverShowButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  neverShowText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
});
