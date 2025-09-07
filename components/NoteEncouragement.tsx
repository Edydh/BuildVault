import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface NoteEncouragementProps {
  mediaId: string;
  hasNote: boolean;
  currentNote?: string;
  onNoteSave: (note: string) => void;
  onNoteUpdate: (note: string) => void;
  mediaType: 'photo' | 'video' | 'doc';
  showPrompt?: boolean;
  onPromptDismiss?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function NoteEncouragement({
  mediaId,
  hasNote,
  currentNote = '',
  onNoteSave,
  onNoteUpdate,
  mediaType,
  showPrompt = false,
  onPromptDismiss,
}: NoteEncouragementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(currentNote);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Quick note suggestions based on media type
  const quickNotes = {
    photo: [
      'Progress shot',
      'Before work',
      'After completion',
      'Issue found',
      'Quality check',
      'Safety concern',
      'Material delivery',
      'Equipment setup',
    ],
    video: [
      'Process recording',
      'Safety demonstration',
      'Issue documentation',
      'Progress update',
      'Quality inspection',
      'Equipment operation',
      'Team meeting',
      'Site walkthrough',
    ],
    doc: [
      'Permit document',
      'Safety checklist',
      'Quality report',
      'Invoice',
      'Contract',
      'Specification',
      'Drawing',
      'Certificate',
    ],
  };

  // Pulse animation for visual indicator
  useEffect(() => {
    if (!hasNote && showPrompt) {
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
  }, [hasNote, showPrompt]);

  const handleSaveNote = () => {
    if (noteText.trim()) {
      if (hasNote) {
        onNoteUpdate(noteText.trim());
      } else {
        onNoteSave(noteText.trim());
      }
      setIsEditing(false);
      setShowQuickAdd(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleQuickNote = (note: string) => {
    setNoteText(note);
    handleSaveNote();
  };

  const handleEdit = () => {
    setNoteText(currentNote);
    setIsEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCancel = () => {
    setNoteText(currentNote);
    setIsEditing(false);
    setShowQuickAdd(false);
  };

  // Visual indicator for media without notes
  if (!hasNote && !isEditing && !showQuickAdd) {
    return (
      <View style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
      }}>
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
        }}>
          <TouchableOpacity
            onPress={() => setShowQuickAdd(true)}
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

  // Quick add modal
  if (showQuickAdd) {
    return (
      <Modal
        visible={showQuickAdd}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#1F2A37',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <Ionicons 
                name={mediaType === 'photo' ? 'camera' : mediaType === 'video' ? 'videocam' : 'document'} 
                size={24} 
                color="#3B82F6" 
              />
              <Text style={{
                color: '#F8FAFC',
                fontSize: 18,
                fontWeight: 'bold',
                marginLeft: 12,
              }}>
                Add Note to {mediaType === 'photo' ? 'Photo' : mediaType === 'video' ? 'Video' : 'Document'}
              </Text>
            </View>

            <Text style={{
              color: '#94A3B8',
              fontSize: 14,
              marginBottom: 16,
              lineHeight: 20,
            }}>
              Notes help you find this media later when searching. Choose a quick note or write your own:
            </Text>

            {/* Quick note suggestions */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 16,
            }}>
              {quickNotes[mediaType].map((note, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleQuickNote(note)}
                  style={{
                    backgroundColor: '#374151',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{
                    color: '#F8FAFC',
                    fontSize: 12,
                  }}>
                    {note}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom note input */}
            <TextInput
              style={{
                backgroundColor: '#374151',
                borderRadius: 8,
                padding: 12,
                color: '#F8FAFC',
                fontSize: 16,
                marginBottom: 16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              placeholder="Or write your own note..."
              placeholderTextColor="#6B7280"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
            />

            {/* Action buttons */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={{
                  backgroundColor: '#374151',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flex: 1,
                  marginRight: 8,
                }}
              >
                <Text style={{
                  color: '#F8FAFC',
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveNote}
                disabled={!noteText.trim()}
                style={{
                  backgroundColor: noteText.trim() ? '#3B82F6' : '#374151',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  Save Note
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Note display and edit
  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 16,
    }}>
      {isEditing ? (
        <View>
          <TextInput
            style={{
              backgroundColor: '#374151',
              borderRadius: 8,
              padding: 12,
              color: '#F8FAFC',
              fontSize: 16,
              marginBottom: 12,
              minHeight: 60,
              textAlignVertical: 'top',
            }}
            placeholder="Add a note to help with searching..."
            placeholderTextColor="#6B7280"
            value={noteText}
            onChangeText={setNoteText}
            multiline
            autoFocus
          />
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
            <TouchableOpacity
              onPress={handleCancel}
              style={{
                backgroundColor: '#374151',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Text style={{
                color: '#F8FAFC',
                fontSize: 14,
                fontWeight: '600',
              }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSaveNote}
              disabled={!noteText.trim()}
              style={{
                backgroundColor: noteText.trim() ? '#3B82F6' : '#374151',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '600',
              }}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          {hasNote ? (
            <View>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="document-text" size={16} color="#10B981" />
                <Text style={{
                  color: '#10B981',
                  fontSize: 14,
                  fontWeight: '600',
                  marginLeft: 6,
                }}>
                  Note Added
                </Text>
                <TouchableOpacity
                  onPress={handleEdit}
                  style={{ marginLeft: 'auto' }}
                >
                  <Ionicons name="create-outline" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text style={{
                color: '#F8FAFC',
                fontSize: 14,
                lineHeight: 20,
              }}>
                {currentNote}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowQuickAdd(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
              <Text style={{
                color: '#F59E0B',
                fontSize: 16,
                fontWeight: '600',
                marginLeft: 8,
              }}>
                Add Note for Better Search
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
