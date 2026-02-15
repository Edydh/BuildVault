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
import { Project, ProjectStatus } from '../lib/db';
import { GlassButton, GlassTextInput, GlassModal } from './glass';

type EditProjectPayload = {
  name: string;
  client?: string;
  location?: string;
  status?: ProjectStatus;
  progress?: number;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
};

interface EditProjectModalProps {
  visible: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (id: string, data: EditProjectPayload) => void | Promise<void>;
}

type DateParseResult = number | null | 'invalid';

type FormState = {
  name: string;
  client: string;
  location: string;
  status: ProjectStatus;
  progress: string;
  budget: string;
  startDate: string;
  endDate: string;
};

const STATUS_META: Array<{ value: ProjectStatus; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'active', label: 'Active', color: '#16A34A', icon: 'checkmark-circle-outline' },
  { value: 'delayed', label: 'Delayed', color: '#F59E0B', icon: 'time-outline' },
  { value: 'completed', label: 'Completed', color: '#3A63F3', icon: 'trophy-outline' },
  { value: 'neutral', label: 'On Hold', color: '#94A3B8', icon: 'pause-circle-outline' },
];

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
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<FormState>({
    name: '',
    client: '',
    location: '',
    status: 'active',
    progress: '0',
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
        status: project.status || 'active',
        progress: String(project.progress ?? 0),
        budget: project.budget != null ? String(project.budget) : '',
        startDate: toDateInput(project.start_date),
        endDate: toDateInput(project.end_date),
      });
    } else {
      setForm({
        name: '',
        client: '',
        location: '',
        status: 'active',
        progress: '0',
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

    const progress = Number(form.progress.trim());
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      Alert.alert('Error', 'Progress must be a number between 0 and 100');
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
        status: form.status,
        progress: Math.round(progress),
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

              <Text style={{ fontSize: 16, fontWeight: '600', color: '#F8FAFC', marginBottom: 8 }}>
                Status
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
                {STATUS_META.map((status) => {
                  const selected = form.status === status.value;
                  return (
                    <TouchableOpacity
                      key={status.value}
                      onPress={() => setForm((prev) => ({ ...prev, status: status.value }))}
                      activeOpacity={0.85}
                      style={{
                        width: '48%',
                        marginBottom: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected ? status.color : 'rgba(148, 163, 184, 0.28)',
                        backgroundColor: selected ? `${status.color}26` : 'rgba(30, 41, 59, 0.85)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name={status.icon} size={15} color={selected ? status.color : '#94A3B8'} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? status.color : '#CBD5E1' }}>
                        {status.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <GlassTextInput
                label="Progress (%)"
                value={form.progress}
                onChangeText={(text) => setForm((prev) => ({ ...prev, progress: text }))}
                placeholder="0 to 100"
                keyboardType="numeric"
                returnKeyType="next"
              />

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
