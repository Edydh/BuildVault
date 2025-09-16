import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Project, createProject, getProjects, deleteProject, updateProject, getMediaByProject } from '../../lib/db';
import { ensureProjectDir, deleteProjectDir } from '../../lib/files';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import { GlassHeader, GlassCard, GlassTextInput, GlassButton, GlassFAB, GlassModal, GlassActionSheet } from '../../components/glass';
import Animated from 'react-native-reanimated';
import { useScrollContext } from '../../components/glass/ScrollContext';
import EditProjectModal from '../../components/EditProjectModal';
import ProjectCard from '../../components/ProjectCard';

export default function ProjectsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', client: '', location: '', search: '' });
  const [showProjectOptions, setShowProjectOptions] = useState<{visible: boolean; project?: Project}>({ visible: false });
  const [showErrorSheet, setShowErrorSheet] = useState(false);
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Filter projects based on search term
  const filteredProjects = projects.filter(p => {
    const searchTerm = form.search?.toLowerCase() || '';
    
    // Search in basic project fields
    const basicMatch = p.name.toLowerCase().includes(searchTerm) ||
                      p.client?.toLowerCase().includes(searchTerm) ||
                      p.location?.toLowerCase().includes(searchTerm);
    
    if (basicMatch) return true;
    
    // Search in media comments/notes
    const mediaItems = getMediaByProject(p.id);
    const mediaMatch = mediaItems.some(media => 
      media.note?.toLowerCase().includes(searchTerm)
    );
    
    return mediaMatch;
  });
  
  // Animation values for dynamic header
  const { scrollY } = useScrollContext();
  const flatListRef = useRef<FlatList>(null);

  const loadProjects = useCallback(() => {
    setProjects(getProjects());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  // Handle scroll events for dynamic header and tab bar
  const handleScroll = (event: any) => {
    'worklet';
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const handleCreateProject = async () => {
    if (!form.name.trim()) {
      setSheetMessage('Project name is required');
      setShowErrorSheet(true);
      return;
    }

    try {
      const project = createProject({
        name: form.name.trim(),
        client: form.client.trim() || undefined,
        location: form.location.trim() || undefined,
      });

      await ensureProjectDir(project.id);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowCreate(false);
      setForm({ name: '', client: '', location: '', search: '' });
      loadProjects();
    } catch (error) {
      setSheetMessage('Failed to create project');
      setShowErrorSheet(true);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEdit(true);
  };

  const handleUpdateProject = (id: string, data: { name: string; client?: string; location?: string }) => {
    try {
      updateProject(id, data);
      loadProjects();
      setShowEdit(false);
      setEditingProject(null);
    } catch (error) {
      setSheetMessage('Failed to update project');
      setShowErrorSheet(true);
    }
  };

  const handleCloseEditModal = () => {
    setShowEdit(false);
    setEditingProject(null);
  };

  const handleShareProject = async (project: Project) => {
    setSelectedProject(project);
    setShowShareSheet(true);
  };

  const shareProjectSummary = async (project: Project) => {
    try {
      // Create project summary data (metadata only)
      const projectData = {
        project: {
          name: project.name,
          client: project.client,
          location: project.location,
          created_at: project.created_at,
        },
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        note: 'This is a project summary from BuildVault. Media files are not included in this export.',
      };

      // Create export file
      const exportFileName = `BuildVault_Project_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Summary_${new Date().toISOString().split('T')[0]}.json`;
      const exportPath = FileSystem.documentDirectory + exportFileName;
      
      await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(projectData, null, 2));

      // Share the export file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportPath, {
          mimeType: 'application/json',
          dialogTitle: `Share Project Summary: ${project.name}`,
        });
      } else {
        setSheetMessage(`Project summary exported to: ${exportFileName}`);
        setShowSuccessSheet(true);
      }

    } catch (error) {
      console.error('Project summary sharing error:', error);
      setSheetMessage('Failed to share project summary. Please try again.');
      setShowErrorSheet(true);
    }
  };

  const shareProjectWithMedia = async (project: Project) => {
    try {
      // Show progress message - we could add a loading state here in the future
      console.log('Preparing project with all media files...');
      
      // Get media for this project
      const { getMediaByProject } = await import('../../lib/db');
      const media = getMediaByProject(project.id);
      
      // Create a project folder structure
      const projectFolderName = `BuildVault_Project_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`;
      const projectFolderPath = FileSystem.documentDirectory + projectFolderName + '/';
      
      // Create project folder
      await FileSystem.makeDirectoryAsync(projectFolderPath, { intermediates: true });
      
      // Create project info file
      const projectData = {
        project: {
          name: project.name,
          client: project.client,
          location: project.location,
          created_at: project.created_at,
        },
        media: media.map(item => ({
          type: item.type,
          note: item.note,
          created_at: item.created_at,
          filename: `${item.type}_${item.created_at}.${item.type === 'photo' ? 'jpg' : item.type === 'video' ? 'mp4' : 'pdf'}`,
        })),
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        note: 'This project includes all media files. Open the project_info.json file for details.',
      };
      
      const projectInfoPath = projectFolderPath + 'project_info.json';
      await FileSystem.writeAsStringAsync(projectInfoPath, JSON.stringify(projectData, null, 2));
      
      // Copy all media files to the project folder
      const copiedFiles = [];
      for (const mediaItem of media) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
          if (fileInfo.exists) {
            const fileExtension = mediaItem.type === 'photo' ? 'jpg' : 
                                mediaItem.type === 'video' ? 'mp4' : 'pdf';
            const fileName = `${mediaItem.type}_${mediaItem.created_at}.${fileExtension}`;
            const destinationPath = projectFolderPath + fileName;
            
            await FileSystem.copyAsync({
              from: mediaItem.uri,
              to: destinationPath,
            });
            
            copiedFiles.push(destinationPath);
            console.log(`Copied file: ${fileName}`);
          }
        } catch (fileError) {
          console.log(`Could not copy file: ${mediaItem.uri}`, fileError);
        }
      }
      
      // Share the project info file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(projectInfoPath, {
          mimeType: 'application/json',
          dialogTitle: `Share Project with Media: ${project.name}`,
        });
        
        // Show detailed info about what was shared
        setSheetMessage(`Project "${project.name}" has been prepared for sharing.\n\n📁 Files created:\n• project_info.json (project details)\n• ${copiedFiles.length} media files\n\n💡 To share all files:\n1. Use Files app to access the project folder\n2. Select all files in the folder\n3. Share via cloud storage (Google Drive, iCloud, Dropbox)\n\n📂 Folder location: ${projectFolderName}`);
        setShowSuccessSheet(true);
      } else {
        setSheetMessage(`Project with media exported to: ${projectFolderName}\n\nFiles created: ${copiedFiles.length + 1} files`);
        setShowSuccessSheet(true);
      }

    } catch (error) {
      console.error('Project with media sharing error:', error);
      setSheetMessage('Failed to share project with media. Please try again.');
      setShowErrorSheet(true);
    }
  };

  const handleProjectOptions = (project: Project) => {
    setShowProjectOptions({ visible: true, project });
  };

  const handleDeleteProject = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteSheet(true);
  };

  const confirmDeleteProject = async () => {
    if (!selectedProject) return;
    
    try {
      // Delete project directory and all media files
      await deleteProjectDir(selectedProject.id);
      
      // Delete project from database (this will cascade delete media records)
      deleteProject(selectedProject.id);
      
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Refresh the projects list
      loadProjects();
      
      setShowDeleteSheet(false);
      setSheetMessage('Project deleted successfully');
      setShowSuccessSheet(true);
    } catch (error) {
      console.error('Error deleting project:', error);
      setShowDeleteSheet(false);
      setSheetMessage('Failed to delete project. Please try again.');
      setShowErrorSheet(true);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <GlassHeader
        title="BuildVault"
        scrollY={scrollY}
        search={{
          value: form.search || '',
          onChange: (text) => setForm((prev) => ({ ...prev, search: text })),
          placeholder: 'Search projects...',
        }}
        transparent={false}
      />

      <Animated.FlatList
        ref={flatListRef}
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          padding: 16, 
          paddingTop: insets.top + 120, // Header height + search bar + spacing
          paddingBottom: insets.bottom + 100, // Tab bar + safe area
        }}
        renderItem={({ item }) => (
          <ProjectCard 
            project={item} 
            onPress={() => router.push(`/project/${item.id}`)}
            onLongPress={() => handleProjectOptions(item)}
          />
        )}
        onScroll={handleScroll}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
        style={{ flex: 1 }}
        bounces={true}
        scrollEnabled={true}
        alwaysBounceVertical={true}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={() => (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="albums" size={64} color="#1F2A37" style={{ marginBottom: 20 }} />
            <Text style={{ color: '#94A3B8', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
              No projects yet
            </Text>
            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center' }}>
              Create your first construction project to get started
            </Text>

          </View>
        )}
      />



      <GlassFAB
        icon="add"
        size={60}
        onPress={() => setShowCreate(true)}
        style={{ position: 'absolute', right: 20, bottom: insets.bottom + 30 }}
      />

      <GlassModal visible={showCreate} onRequestClose={() => setShowCreate(false)}>
        <ScrollView 
          style={{ maxHeight: '100%' }}
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
                  <Text style={{
                    color: '#F8FAFC',
                    fontSize: 24,
                    fontWeight: 'bold',
                    marginBottom: 20,
                    textAlign: 'center',
                  }}>
                    New Project
                  </Text>

              <GlassTextInput
                label="Project Name"
                required
                value={form.name}
                onChangeText={(text) => setForm(prev => ({ ...prev, name: text }))}
                placeholder="Enter project name"
                autoCapitalize="words"
                returnKeyType="next"
              />

              <GlassTextInput
                label="Client"
                value={form.client}
                onChangeText={(text) => setForm(prev => ({ ...prev, client: text }))}
                placeholder="Enter client name (optional)"
                autoCapitalize="words"
                returnKeyType="next"
              />

              <GlassTextInput
                label="Location"
                value={form.location}
                onChangeText={(text) => setForm(prev => ({ ...prev, location: text }))}
                placeholder="Enter project location (optional)"
                autoCapitalize="words"
                returnKeyType="done"
              />

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <GlassButton
                  variant="secondary"
                  size="large"
                  title="Cancel"
                  onPress={() => setShowCreate(false)}
                  style={{ flex: 1 }}
                />
                <GlassButton
                  variant="primary"
                  size="large"
                  title="Create"
                  onPress={handleCreateProject}
                  disabled={!form.name.trim()}
                  style={{ flex: 1 }}
                />
              </View>
        </ScrollView>
      </GlassModal>

      {/* Project Options - Glass Action Sheet */}
      <GlassActionSheet
        visible={showProjectOptions.visible}
        onClose={() => setShowProjectOptions({ visible: false })}
        title={showProjectOptions.project ? showProjectOptions.project.name : 'Project Options'}
        actions={[
          {
            label: 'Edit Project',
            onPress: () => showProjectOptions.project && handleEditProject(showProjectOptions.project),
          },
          {
            label: 'Share Project',
            onPress: () => showProjectOptions.project && handleShareProject(showProjectOptions.project),
          },
          {
            label: 'Delete Project',
            destructive: true,
            onPress: () => showProjectOptions.project && handleDeleteProject(showProjectOptions.project),
          },
        ]}
      />

      {/* Edit Project Modal */}
      <EditProjectModal
        visible={showEdit}
        project={editingProject}
        onClose={handleCloseEditModal}
        onSave={handleUpdateProject}
      />
      
      {/* Share Project Action Sheet */}
      <GlassActionSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title="Share Project"
        message="How would you like to share this project?"
        actions={[
          {
            label: 'Share Summary Only',
            onPress: () => {
              setShowShareSheet(false);
              if (selectedProject) shareProjectSummary(selectedProject);
            },
          },
          {
            label: 'Share with Media Files',
            onPress: () => {
              setShowShareSheet(false);
              if (selectedProject) shareProjectWithMedia(selectedProject);
            },
          },
          {
            label: 'Cancel',
            onPress: () => setShowShareSheet(false),
          },
        ]}
      />
      
      {/* Delete Project Action Sheet */}
      <GlassActionSheet
        visible={showDeleteSheet}
        onClose={() => setShowDeleteSheet(false)}
        title="Delete Project"
        message={selectedProject ? `Delete "${selectedProject.name}" and all its media? This action cannot be undone.` : 'Delete this project?'}
        actions={[
          {
            label: 'Delete Project',
            destructive: true,
            onPress: confirmDeleteProject,
          },
          {
            label: 'Cancel',
            onPress: () => setShowDeleteSheet(false),
          },
        ]}
      />
      
      {/* Success Action Sheet */}
      <GlassActionSheet
        visible={showSuccessSheet}
        onClose={() => setShowSuccessSheet(false)}
        title="Success"
        message={sheetMessage}
        actions={[
          {
            label: 'OK',
            onPress: () => setShowSuccessSheet(false),
          },
        ]}
      />
      
      {/* Error Action Sheet */}
      <GlassActionSheet
        visible={showErrorSheet}
        onClose={() => setShowErrorSheet(false)}
        title="Error"
        message={sheetMessage}
        actions={[
          {
            label: 'OK',
            onPress: () => setShowErrorSheet(false),
          },
        ]}
      />
    </View>
  );
}
