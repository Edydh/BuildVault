import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Project } from '../lib/db';
import { GlassCard, GlassButton } from './glass';

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
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    name: '',
    client: '',
    location: '',
  });

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      console.log('EditProjectModal - Loading project:', project);
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
    } catch (error) {
      Alert.alert('Error', 'Failed to update project');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!project) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, backgroundColor: 'rgba(11, 15, 20, 0.95)' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View
              style={{
                flex: 1,
                paddingTop: insets.top + 20,
                paddingBottom: insets.bottom + 20,
                paddingHorizontal: 20,
              }}
            >
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

              {/* Debug Info */}
              <Text style={{ color: '#F8FAFC', marginBottom: 10 }}>
                Debug: {project?.name} - Form: {form.name}
              </Text>

              {/* Form */}
              <View style={{ 
                backgroundColor: 'rgba(16, 24, 38, 0.9)', 
                borderRadius: 16, 
                padding: 20, 
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(100, 116, 139, 0.3)',
              }}>
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#F8FAFC',
                      marginBottom: 8,
                    }}
                  >
                    Project Name *
                  </Text>
                  <TextInput
                    value={form.name}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                    placeholder="Enter project name"
                    placeholderTextColor="#64748B"
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: '#F8FAFC',
                      borderWidth: 2,
                      borderColor: '#64748B',
                      minHeight: 50,
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#F8FAFC',
                      marginBottom: 8,
                    }}
                  >
                    Client
                  </Text>
                  <TextInput
                    value={form.client}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, client: text }))}
                    placeholder="Enter client name"
                    placeholderTextColor="#64748B"
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: '#F8FAFC',
                      borderWidth: 2,
                      borderColor: '#64748B',
                      minHeight: 50,
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <View style={{ marginBottom: 0 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#F8FAFC',
                      marginBottom: 8,
                    }}
                  >
                    Location
                  </Text>
                  <TextInput
                    value={form.location}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, location: text }))}
                    placeholder="Enter project location"
                    placeholderTextColor="#64748B"
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: '#F8FAFC',
                      borderWidth: 2,
                      borderColor: '#64748B',
                      minHeight: 50,
                    }}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
              </View>

              {/* Actions */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  marginTop: 'auto',
                }}
              >
                <GlassButton
                  variant="secondary"
                  size="large"
                  onPress={handleClose}
                  style={{ flex: 1 }}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  size="large"
                  onPress={handleSave}
                  style={{ flex: 1 }}
                >
                  Save Changes
                </GlassButton>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default EditProjectModal;
