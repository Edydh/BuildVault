import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Project } from '../lib/db';
import { GlassButton, GlassTextInput, GlassModal } from './glass';

interface EditProjectModalProps {
  visible: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (id: string, data: { name: string; client?: string; location?: string }) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  visible,
  project,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState({
    name: '',
    client: '',
    location: '',
  });

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        client: project.client || '',
        location: project.location || '',
      });
    } else {
      setForm({ name: '', client: '', location: '' });
    }
  }, [project]);

  const handleSave = () => {
    if (!project) return;

    if (!form.name.trim()) {
      Alert.alert('Error', 'Project name is required');
      return;
    }

    try {
      onSave(project.id, {
        name: form.name.trim(),
        client: form.client.trim() || undefined,
        location: form.location.trim() || undefined,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to update project');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!project) return null;

  return (
    <GlassModal visible={visible} onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 30,
                }}
              >
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '700',
                    color: '#F8FAFC',
                  }}
                >
                  Edit Project
                </Text>
                <TouchableOpacity
                  onPress={handleClose}
                  style={{
                    backgroundColor: 'rgba(100, 116, 139, 0.2)',
                    borderRadius: 20,
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Form */}
              <View style={{ 
                backgroundColor: 'rgba(16, 24, 38, 0.9)', 
                borderRadius: 16, 
                padding: 20, 
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(100, 116, 139, 0.3)',
              }}>
                <GlassTextInput
                  label="Project Name"
                  required
                  value={form.name}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                  placeholder="Enter project name"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <GlassTextInput
                  label="Client"
                  value={form.client}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, client: text }))}
                  placeholder="Enter client name"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <GlassTextInput
                  label="Location"
                  value={form.location}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, location: text }))}
                  placeholder="Enter project location"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>

              {/* Actions */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 16,
                  marginTop: 'auto',
                  paddingHorizontal: 4,
                }}
              >
                <GlassButton
                  variant="secondary"
                  size="large"
                  title="Cancel"
                  onPress={handleClose}
                  style={{ flex: 1 }}
                />
                <GlassButton
                  variant="primary"
                  size="large"
                  title="Save"
                  onPress={handleSave}
                  style={{ flex: 1 }}
                />
              </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </GlassModal>
  );
};

export default EditProjectModal;
