import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface NotePromptProps {
  visible: boolean;
  mediaType: 'photo' | 'video' | 'doc';
  onAddNote: () => void;
  onDismiss: () => void;
  onNeverShowAgain: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

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
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

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

  const getMediaTypeInfo = () => {
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <Animated.View
          style={{
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
            opacity: slideAnim,
          }}
        >
          <View style={{
            backgroundColor: '#1F2A37',
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 20,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                }}
              >
                <View style={{
                  backgroundColor: '#3B82F6',
                  borderRadius: 30,
                  padding: 12,
                  marginRight: 16,
                }}>
                  <Ionicons name={mediaInfo.icon} size={24} color="#FFFFFF" />
                </View>
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: '#F8FAFC',
                  fontSize: 20,
                  fontWeight: 'bold',
                }}>
                  {mediaInfo.title}
                </Text>
                <Text style={{
                  color: '#94A3B8',
                  fontSize: 14,
                }}>
                  Help improve searchability
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text style={{
              color: '#F8FAFC',
              fontSize: 16,
              lineHeight: 24,
              marginBottom: 20,
            }}>
              {mediaInfo.description}
            </Text>

            {/* Benefits */}
            <View style={{
              backgroundColor: '#374151',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}>
              <Text style={{
                color: '#F8FAFC',
                fontSize: 14,
                fontWeight: '600',
                marginBottom: 12,
              }}>
                Benefits of adding notes:
              </Text>
              {mediaInfo.benefits.map((benefit, index) => (
                <View key={index} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={{
                    color: '#D1D5DB',
                    fontSize: 14,
                    marginLeft: 8,
                  }}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <TouchableOpacity
                onPress={handleAddNote}
                style={{
                  backgroundColor: '#3B82F6',
                  borderRadius: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  flex: 1,
                  marginRight: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '600',
                  marginLeft: 8,
                }}>
                  Add Note
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDismiss}
                style={{
                  backgroundColor: '#374151',
                  borderRadius: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                <Text style={{
                  color: '#F8FAFC',
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </View>

            {/* Never show again option */}
            <TouchableOpacity
              onPress={handleNeverShow}
              style={{
                alignItems: 'center',
                paddingVertical: 8,
              }}
            >
              <Text style={{
                color: '#6B7280',
                fontSize: 14,
              }}>
                Don't show this again
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
