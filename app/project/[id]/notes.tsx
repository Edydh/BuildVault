import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BVButton, BVCard, BVEmptyState, BVFloatingAction, BVHeader } from '../../../components/ui';
import { GlassModal, GlassTextInput } from '../../../components/glass';
import { Note, Project, getNotesByProject, getProjectById } from '../../../lib/db';
import {
  createProjectNoteInSupabase,
  deleteProjectNoteInSupabase,
  syncProjectNotesFromSupabase,
  syncProjectsAndActivityFromSupabase,
  updateProjectNoteInSupabase,
} from '../../../lib/supabaseProjectsSync';
import { bvColors, bvFx } from '../../../lib/theme/tokens';

function formatRelativeLabel(value: number): string {
  const delta = Date.now() - value;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
  if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))}h ago`;
  if (delta < 604_800_000) return `${Math.max(1, Math.floor(delta / 86_400_000))}d ago`;
  return new Date(value).toLocaleDateString();
}

function getNoteHeading(note: Note): string {
  if (note.title?.trim()) return note.title.trim();
  const firstLine = note.content.split('\n')[0]?.trim() || '';
  if (firstLine) {
    return firstLine.length > 64 ? `${firstLine.slice(0, 64)}…` : firstLine;
  }
  return 'Project note';
}

export default function ProjectNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const refreshData = useCallback(
    async (showLoading = false) => {
      if (!id) return;
      if (showLoading) setLoading(true);

      try {
        const localProject = getProjectById(id);
        if (!localProject) {
          Alert.alert('Error', 'Project not found.');
          router.back();
          return;
        }
        setProject(localProject);
        setNotes(getNotesByProject(id, null));

        await syncProjectNotesFromSupabase(id);
        await syncProjectsAndActivityFromSupabase();

        const syncedProject = getProjectById(id);
        if (syncedProject) {
          setProject(syncedProject);
          setNotes(getNotesByProject(id, null));
        }
      } catch (error) {
        console.error('Project notes refresh error:', error);
      } finally {
        setLoading(false);
      }
    },
    [id, router]
  );

  useFocusEffect(
    useCallback(() => {
      void refreshData(true);
    }, [refreshData])
  );

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
  }, []);

  const openCreateEditor = useCallback(() => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setShowEditor(true);
  }, []);

  const openEditEditor = useCallback((note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title?.trim() || '');
    setNoteContent(note.content || '');
    setShowEditor(true);
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!id) return;
    const content = noteContent.trim();
    if (!content) {
      Alert.alert('Missing details', 'Please add note details.');
      return;
    }

    try {
      setSaving(true);
      if (editingNote) {
        await updateProjectNoteInSupabase(editingNote.id, {
          title: noteTitle.trim() || null,
          content,
        });
      } else {
        await createProjectNoteInSupabase({
          project_id: id,
          title: noteTitle.trim() || null,
          content,
        });
      }
      await syncProjectNotesFromSupabase(id);
      await syncProjectsAndActivityFromSupabase();
      setNotes(getNotesByProject(id, null));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      closeEditor();
    } catch (error) {
      console.error('Save project note error:', error);
      const message = error instanceof Error ? error.message : 'Could not save the note.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }, [closeEditor, editingNote, id, noteContent, noteTitle]);

  const handleDeleteNote = useCallback(
    (note: Note) => {
      if (!id) return;
      Alert.alert(
        'Delete note',
        'This note will be removed from the project timeline.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteProjectNoteInSupabase(note.id);
                  await syncProjectNotesFromSupabase(id);
                  await syncProjectsAndActivityFromSupabase();
                  setNotes(getNotesByProject(id, null));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (error) {
                  console.error('Delete project note error:', error);
                  const message =
                    error instanceof Error ? error.message : 'Could not delete the selected note.';
                  Alert.alert('Delete failed', message);
                }
              })();
            },
          },
        ]
      );
    },
    [id]
  );

  const notesSummary = useMemo(() => {
    if (notes.length === 0) return 'No project notes yet.';
    if (notes.length === 1) return '1 project note';
    return `${notes.length} project notes`;
  }, [notes.length]);

  if (loading && !project) {
    return (
      <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: bvColors.text.muted }}>Loading notes…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
      <BVHeader
        title="Notes"
        subtitle={project?.name || 'Project'}
        onBack={() => router.back()}
      />

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8, flexGrow: 1 }}
        ListHeaderComponent={
          <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
            <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700' }}>Project Notes</Text>
            <Text style={{ color: bvColors.text.muted, marginTop: 4, fontSize: 13 }}>{notesSummary}</Text>
          </BVCard>
        }
        renderItem={({ item }) => (
          <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: bvColors.text.primary, fontSize: 17, fontWeight: '700' }}>
                  {getNoteHeading(item)}
                </Text>
                <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 4 }}>
                  Updated {formatRelativeLabel(item.updated_at)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                <TouchableOpacity
                  onPress={() => openEditEditor(item)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: bvFx.neutralBorderSoft,
                    backgroundColor: bvColors.surface.chrome,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={17} color={bvColors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteNote(item)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: 'rgba(220,38,38,0.45)',
                    backgroundColor: 'rgba(220,38,38,0.16)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={17} color={bvColors.semantic.danger} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={{ color: bvColors.text.secondary, marginTop: 10, fontSize: 15, lineHeight: 21 }}>
              {item.content}
            </Text>
          </BVCard>
        )}
        ListEmptyComponent={
          <BVEmptyState
            title="No project notes yet"
            description="Add project-level notes for scope updates, decisions, and reminders."
            icon="document-text-outline"
            actionLabel="Add Note"
            onAction={openCreateEditor}
            style={{ marginTop: 48 }}
          />
        }
      />

      <BVFloatingAction
        icon="add"
        onPress={openCreateEditor}
      />

      <GlassModal
        visible={showEditor}
        onRequestClose={closeEditor}
        centered={false}
        contentStyle={{ marginTop: 120 }}
      >
        <Text
          style={{
            color: bvColors.text.primary,
            fontSize: 20,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          {editingNote ? 'Edit Project Note' : 'Add Project Note'}
        </Text>

        <GlassTextInput
          label="Title (optional)"
          value={noteTitle}
          onChangeText={setNoteTitle}
          placeholder="e.g. Client change request"
          returnKeyType="next"
          autoCapitalize="sentences"
        />

        <GlassTextInput
          label="Details"
          value={noteContent}
          onChangeText={setNoteContent}
          placeholder="Describe the update, decision, or observation..."
          multiline
          autoCapitalize="sentences"
          inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <BVButton
            title="Cancel"
            variant="ghost"
            onPress={closeEditor}
            style={{ flex: 1, marginRight: 10 }}
            disabled={saving}
          />
          <BVButton
            title={editingNote ? 'Save Changes' : 'Save Note'}
            onPress={handleSaveNote}
            loading={saving}
            style={{ flex: 1 }}
          />
        </View>
      </GlassModal>
    </View>
  );
}
