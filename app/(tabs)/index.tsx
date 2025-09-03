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
  Animated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Project, createProject, getProjects, deleteProject } from '../../lib/db';
import { ensureProjectDir, deleteProjectDir } from '../../lib/files';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';

export default function ProjectsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', location: '' });
  
  // Animation values for dynamic header and tab bar
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;
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
    try {
      const offsetY = event.nativeEvent.contentOffset.y;
      
      // Calculate opacity based on scroll position
      // Start fading at 50px, fully transparent at 150px
      const fadeStart = 50;
      const fadeEnd = 150;
      
      if (offsetY > fadeStart) {
        const progress = Math.min((offsetY - fadeStart) / (fadeEnd - fadeStart), 1);
        const opacity = Math.max(0, 1 - progress);
        
        headerOpacity.setValue(opacity);
        tabBarOpacity.setValue(opacity);
      } else {
        headerOpacity.setValue(1);
        tabBarOpacity.setValue(1);
      }
    } catch (error) {
      // Fallback: keep header and tab bar visible if there's an error
      headerOpacity.setValue(1);
      tabBarOpacity.setValue(1);
    }
  };

  const handleCreateProject = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Project name is required');
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
      setForm({ name: '', client: '', location: '' });
      loadProjects();
    } catch (error) {
      Alert.alert('Error', 'Failed to create project');
    }
  };

  const handleShareProject = async (project: Project) => {
    Alert.alert(
      'Share Project',
      'How would you like to share this project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Summary Only',
          onPress: () => shareProjectSummary(project),
        },
        {
          text: 'Share with Media Files',
          onPress: () => shareProjectWithMedia(project),
        },
      ]
    );
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
        Alert.alert('Export Complete', `Project summary exported to: ${exportFileName}`);
      }

    } catch (error) {
      console.error('Project summary sharing error:', error);
      Alert.alert('Error', 'Failed to share project summary. Please try again.');
    }
  };

  const shareProjectWithMedia = async (project: Project) => {
    try {
      Alert.alert('Share with Media', 'Preparing project with all media files...', [], { cancelable: false });
      
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
        Alert.alert(
          'Project Shared!',
          `Project "${project.name}" has been prepared for sharing.\n\n📁 Files created:\n• project_info.json (project details)\n• ${copiedFiles.length} media files\n\n💡 To share all files:\n1. Use Files app to access the project folder\n2. Select all files in the folder\n3. Share via cloud storage (Google Drive, iCloud, Dropbox)\n\n📂 Folder location: ${projectFolderName}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Export Complete', `Project with media exported to: ${projectFolderName}\n\nFiles created: ${copiedFiles.length + 1} files`);
      }

    } catch (error) {
      console.error('Project with media sharing error:', error);
      Alert.alert('Error', 'Failed to share project with media. Please try again.');
    }
  };

  const handleProjectOptions = (project: Project) => {
    Alert.alert(
      'Project Options',
      `What would you like to do with "${project.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Project',
          onPress: () => handleShareProject(project),
        },
        {
          text: 'Delete Project',
          style: 'destructive',
          onPress: () => handleDeleteProject(project),
        },
      ]
    );
  };

  const handleDeleteProject = (project: Project) => {
    Alert.alert(
      'Delete Project',
      `Delete "${project.name}" and all its media? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete project directory and all media files
              await deleteProjectDir(project.id);
              
              // Delete project from database (this will cascade delete media records)
              deleteProject(project.id);
              
              // Provide haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              // Refresh the projects list
              loadProjects();
              
              Alert.alert('Success', 'Project deleted successfully');
            } catch (error) {
              console.error('Error deleting project:', error);
              Alert.alert('Error', 'Failed to delete project. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <TouchableOpacity
      style={{
        backgroundColor: '#101826',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1F2A37',
      }}
      onPress={() => {
        router.push(`/project/${project.id}`);
      }}
      onLongPress={() => handleProjectOptions(project)}
      activeOpacity={0.7}
    >
      <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600', marginBottom: 4 }}>
        {project.name}
      </Text>
      {project.client && (
        <Text style={{ color: '#94A3B8', fontSize: 14, marginBottom: 2 }}>
          Client: {project.client}
        </Text>
      )}
      {project.location && (
        <Text style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
          Location: {project.location}
        </Text>
      )}
      <Text style={{ color: '#64748B', fontSize: 12 }}>
        Created {formatDate(project.created_at)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }} pointerEvents="box-none">
      <StatusBar barStyle="light-content" backgroundColor="#0B0F14" translucent />
      <Animated.View 
        style={{ 
          padding: 16, 
          paddingTop: insets.top + 16, 
          paddingBottom: 20,
          opacity: headerOpacity,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#0B0F14',
          pointerEvents: 'none',
        }}
      >
        <View style={{ pointerEvents: 'auto' }}>
          <Text style={{ color: '#F8FAFC', fontSize: 28, fontWeight: 'bold' }}>
            BuildVault
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, marginTop: 4 }}>
            Construction Project Manager
          </Text>
        </View>
      </Animated.View>

      <FlatList
        ref={flatListRef}
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          padding: 16, 
          paddingTop: insets.top + 120, // Header height + safe area
          paddingBottom: insets.bottom + 100, // Tab bar height + safe area
          minHeight: '100%'
        }}
        renderItem={({ item }) => <ProjectCard project={item} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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

      {/* Custom Tab Bar Overlay */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#0B0F14',
          borderTopColor: '#1F2A37',
          borderTopWidth: 1,
          opacity: tabBarOpacity,
          zIndex: 1000,
        }}
      >
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingVertical: 8,
          paddingBottom: insets.bottom + 8, // Proper safe area
        }}>
          {/* Projects Tab */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
            }}
            onPress={() => {
              // Already on projects tab, scroll to top
              if (projects.length > 0 && flatListRef.current) {
                flatListRef.current.scrollToOffset({ offset: 0, animated: true });
              }
            }}
          >
            <Ionicons name="albums" size={24} color="#FF7A1A" />
            <Text style={{ color: '#FF7A1A', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
              Projects
            </Text>
          </TouchableOpacity>

          {/* Settings Tab */}
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
            }}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings" size={24} color="#94A3B8" />
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 100, // Proper safe area + tab bar height
          backgroundColor: '#FF7A1A',
          width: 60,
          height: 60,
          borderRadius: 30,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={30} color="#0B0F14" />
      </TouchableOpacity>

      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}>
            <View style={{
              backgroundColor: '#101826',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 40,
            }}>
              <Text style={{
                color: '#F8FAFC',
                fontSize: 24,
                fontWeight: 'bold',
                marginBottom: 20,
                textAlign: 'center',
              }}>
                New Project
              </Text>

              <TextInput
                style={{
                  backgroundColor: '#1F2A37',
                  borderRadius: 12,
                  padding: 16,
                  color: '#F8FAFC',
                  fontSize: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#374151',
                }}
                placeholder="Project name *"
                placeholderTextColor="#64748B"
                value={form.name}
                onChangeText={(text) => setForm(prev => ({ ...prev, name: text }))}
                autoFocus
              />

              <TextInput
                style={{
                  backgroundColor: '#1F2A37',
                  borderRadius: 12,
                  padding: 16,
                  color: '#F8FAFC',
                  fontSize: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#374151',
                }}
                placeholder="Client (optional)"
                placeholderTextColor="#64748B"
                value={form.client}
                onChangeText={(text) => setForm(prev => ({ ...prev, client: text }))}
              />

              <TextInput
                style={{
                  backgroundColor: '#1F2A37',
                  borderRadius: 12,
                  padding: 16,
                  color: '#F8FAFC',
                  fontSize: 16,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: '#374151',
                }}
                placeholder="Location (optional)"
                placeholderTextColor="#64748B"
                value={form.location}
                onChangeText={(text) => setForm(prev => ({ ...prev, location: text }))}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#374151',
                    borderRadius: 12,
                    padding: 16,
                    flex: 1,
                    marginRight: 8,
                    alignItems: 'center',
                  }}
                  onPress={() => setShowCreate(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: form.name.trim() ? '#FF7A1A' : '#374151',
                    borderRadius: 12,
                    padding: 16,
                    flex: 1,
                    marginLeft: 8,
                    alignItems: 'center',
                  }}
                  onPress={handleCreateProject}
                  disabled={!form.name.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={{
                    color: form.name.trim() ? '#0B0F14' : '#64748B',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    Create Project
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
