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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Organization, Project } from '../lib/db';
import { GlassButton, GlassTextInput, GlassModal } from './glass';

type EditProjectPayload = {
  name: string;
  client?: string;
  location?: string;
  organization_id?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
};

interface EditProjectModalProps {
  visible: boolean;
  project: Project | null;
  organizations?: Organization[];
  onClose: () => void;
  onSave: (id: string, data: EditProjectPayload) => void | Promise<void>;
}

type DateParseResult = number | null | 'invalid';

type FormState = {
  name: string;
  client: string;
  location: string;
  organizationId: string | null;
  budget: string;
  startDate: string;
  endDate: string;
};

const toDateInput = (value?: number | null): string => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const parseDateInput = (value: string): DateParseResult => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return 'invalid';
  return parsed;
};

const parseBudgetInput = (value: string): number | null | 'invalid' => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
  return parsed;
};

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  visible,
  project,
  organizations = [],
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<FormState>({
    name: '',
    client: '',
    location: '',
    organizationId: null,
    budget: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        client: project.client || '',
        location: project.location || '',
        organizationId: project.organization_id || null,
        budget: project.budget != null ? String(project.budget) : '',
        startDate: toDateInput(project.start_date),
        endDate: toDateInput(project.end_date),
      });
    } else {
      setForm({
        name: '',
        client: '',
        location: '',
        organizationId: null,
        budget: '',
        startDate: '',
        endDate: '',
      });
    }
  }, [project]);

  const handleSave = async () => {
    if (!project) return;

    if (!form.name.trim()) {
      Alert.alert('Error', 'Project name is required');
      return;
    }

    const parsedStartDate = parseDateInput(form.startDate);
    if (parsedStartDate === 'invalid') {
      Alert.alert('Error', 'Start Date must be a valid date (YYYY-MM-DD)');
      return;
    }

    const parsedEndDate = parseDateInput(form.endDate);
    if (parsedEndDate === 'invalid') {
      Alert.alert('Error', 'End Date must be a valid date (YYYY-MM-DD)');
      return;
    }

    if (typeof parsedStartDate === 'number' && typeof parsedEndDate === 'number' && parsedEndDate < parsedStartDate) {
      Alert.alert('Error', 'End Date cannot be before Start Date');
      return;
    }

    const parsedBudget = parseBudgetInput(form.budget);
    if (parsedBudget === 'invalid') {
      Alert.alert('Error', 'Budget must be a positive number');
      return;
    }

    try {
      await onSave(project.id, {
        name: form.name.trim(),
        client: form.client.trim() || undefined,
        location: form.location.trim() || undefined,
        organization_id: form.organizationId || null,
        start_date: parsedStartDate,
        end_date: parsedEndDate,
        budget: parsedBudget,
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
          <ScrollView
            style={{ maxHeight: '100%' }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
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

            <View
              style={{
                backgroundColor: 'rgba(16, 24, 38, 0.9)',
                borderRadius: 16,
                padding: 20,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(100, 116, 139, 0.3)',
              }}
            >
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
                returnKeyType="next"
              />

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#F8FAFC',
                    marginBottom: 8,
                  }}
                >
                  Workspace
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', paddingRight: 4 }}>
                    <TouchableOpacity
                      onPress={() => setForm((prev) => ({ ...prev, organizationId: null }))}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: form.organizationId === null ? 'rgba(58, 99, 243, 0.45)' : 'rgba(148, 163, 184, 0.28)',
                        backgroundColor: form.organizationId === null ? 'rgba(58, 99, 243, 0.2)' : 'rgba(148, 163, 184, 0.12)',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: form.organizationId === null ? '#3A63F3' : '#CBD5E1',
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        Personal
                      </Text>
                    </TouchableOpacity>
                    {organizations.map((organization) => {
                      const selected = form.organizationId === organization.id;
                      return (
                        <TouchableOpacity
                          key={organization.id}
                          onPress={() => setForm((prev) => ({ ...prev, organizationId: organization.id }))}
                          style={{
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selected ? 'rgba(58, 99, 243, 0.45)' : 'rgba(148, 163, 184, 0.28)',
                            backgroundColor: selected ? 'rgba(58, 99, 243, 0.2)' : 'rgba(148, 163, 184, 0.12)',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginRight: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? '#3A63F3' : '#CBD5E1',
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {organization.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <GlassTextInput
                label="Budget (Optional)"
                value={form.budget}
                onChangeText={(text) => setForm((prev) => ({ ...prev, budget: text }))}
                placeholder="e.g. 1250000"
                keyboardType="numeric"
                returnKeyType="next"
              />

              <GlassTextInput
                label="Start Date"
                value={form.startDate}
                onChangeText={(text) => setForm((prev) => ({ ...prev, startDate: text }))}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <GlassTextInput
                label="End Date"
                value={form.endDate}
                onChangeText={(text) => setForm((prev) => ({ ...prev, endDate: text }))}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

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
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </GlassModal>
  );
};

export default EditProjectModal;
