import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Project, createProject, getProjects, deleteProject, updateProject, getMediaByProject } from '../../lib/db';
import { ensureProjectDir, deleteProjectDir } from '../../lib/files';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import { GlassHeader, GlassCard, GlassTextInput, GlassButton, GlassFAB, GlassModal, GlassActionSheet } from '../../components/glass';
import { FAB_BOTTOM_OFFSET } from '../../components/glass/layout';
import Animated from 'react-native-reanimated';
import { useScrollContext } from '../../components/glass/ScrollContext';
import EditProjectModal from '../../components/EditProjectModal';
import ProjectCard from '../../components/ProjectCard';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface StorageStats {
  totalProjects: number;
  totalMedia: number;
  totalPhotos: number;
  totalVideos: number;
  totalDocs: number;
  totalSize: number;
  photoSize: number;
  videoSize: number;
  docSize: number;
}

const EMPTY_STATS: StorageStats = {
  totalProjects: 0,
  totalMedia: 0,
  totalPhotos: 0,
  totalVideos: 0,
  totalDocs: 0,
  totalSize: 0,
  photoSize: 0,
  videoSize: 0,
  docSize: 0,
};

const formatBytes = (bytes: number): string => {
  if (!bytes) {
    return '0 MB';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);

  if (exponent === 0) {
    return `${bytes} B`;
  }

  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
};

const formatCount = (value: number): string => value.toLocaleString();

interface StatCardConfig {
  key: string;
  label: string;
  value: string;
  subtext: string;
  icon: IoniconName;
  accentColor: string;
  accentBackground: string;
  accentBorder: string;
}

const StatCard: React.FC<StatCardConfig & { style?: ViewStyle }> = ({
  label,
  value,
  subtext,
  icon,
  accentColor,
  accentBackground,
  accentBorder,
  style,
}) => (
  <GlassCard
    intensity={70}
    shadowEnabled={false}
    style={[
      {
        padding: 18,
        borderRadius: 18,
        width: 180,
      },
      style,
    ]}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: accentBackground,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
          borderWidth: 1,
          borderColor: accentBorder,
        }}
      >
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>
      <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
    <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '700' }}>{value}</Text>
    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 6 }}>{subtext}</Text>
  </GlassCard>
);

export default function ProjectsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', client: '', location: '', search: '' });
  const [sortBy, setSortBy] = useState<'date_desc'|'date_asc'|'name_asc'|'client_asc'|'location_asc'>('date_desc');
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(form.search);
  const projectFilterCount = (hasNotesOnly ? 1 : 0) + (sortBy !== 'date_desc' ? 1 : 0);
  const [showProjectOptions, setShowProjectOptions] = useState<{visible: boolean; project?: Project}>({ visible: false });
  const [showErrorSheet, setShowErrorSheet] = useState(false);
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Persist and load filters
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@buildvault/project-filters');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.sortBy) setSortBy(saved.sortBy);
          if (typeof saved.hasNotesOnly === 'boolean') setHasNotesOnly(saved.hasNotesOnly);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('@buildvault/project-filters', JSON.stringify({ sortBy, hasNotesOnly }));
      } catch {}
    })();
  }, [sortBy, hasNotesOnly]);

  // Debounce search input for smoother filtering on large lists
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(form.search), 250);
    return () => clearTimeout(id);
  }, [form.search]);

  // Filter + sort projects
  const filteredProjects = React.useMemo(() => {
    const searchTerm = (debouncedSearch || '').toLowerCase();
    const filtered = projects.filter(p => {
      // Basic fields
      const basicMatch = !searchTerm || (
        p.name.toLowerCase().includes(searchTerm) ||
        (p.client || '').toLowerCase().includes(searchTerm) ||
        (p.location || '').toLowerCase().includes(searchTerm)
      );

      // Notes match
      const mediaItems = getMediaByProject(p.id);
      const notesMatch = !searchTerm ? false : mediaItems.some(m => (m.note || '').toLowerCase().includes(searchTerm));

      const anyMatch = basicMatch || notesMatch;
      if (!anyMatch) return false;

      if (hasNotesOnly) {
        const hasAnyNote = mediaItems.some(m => (m.note || '').trim().length > 0);
        if (!hasAnyNote) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'client_asc':
          return (a.client || '').localeCompare(b.client || '');
        case 'location_asc':
          return (a.location || '').localeCompare(b.location || '');
        case 'date_asc':
          return a.created_at - b.created_at;
        case 'date_desc':
        default:
          return b.created_at - a.created_at;
      }
    });
    return sorted;
  }, [projects, debouncedSearch, hasNotesOnly, sortBy]);
  
  // Animation values for dynamic header
  const { scrollY } = useScrollContext();
  const flatListRef = useRef<FlatList>(null);

  const computeStorageStats = useCallback(async (projectList: Project[]): Promise<StorageStats> => {
    const stats: StorageStats = {
      ...EMPTY_STATS,
      totalProjects: projectList.length,
    };

    if (projectList.length === 0) {
      return stats;
    }

    const sizePromises: Promise<void>[] = [];

    for (const project of projectList) {
      const mediaItems = getMediaByProject(project.id);
      stats.totalMedia += mediaItems.length;

      mediaItems.forEach((item) => {
        if (item.type === 'photo') {
          stats.totalPhotos += 1;
        } else if (item.type === 'video') {
          stats.totalVideos += 1;
        } else {
          stats.totalDocs += 1;
        }

        sizePromises.push(
          (async () => {
            try {
              const info = await FileSystem.getInfoAsync(item.uri);
              if (info.exists && !info.isDirectory) {
                const size = info.size ?? 0;
                stats.totalSize += size;
                if (item.type === 'photo') {
                  stats.photoSize += size;
                } else if (item.type === 'video') {
                  stats.videoSize += size;
                } else {
                  stats.docSize += size;
                }
              }
            } catch (error) {
              console.warn('Failed to read media size:', error);
            }
          })()
        );
      });
    }

    if (sizePromises.length > 0) {
      await Promise.all(sizePromises);
    }

    return stats;
  }, []);

  const loadProjects = useCallback(async () => {
    setStatsLoading(true);
    try {
      const projectList = getProjects();
      setProjects(projectList);
      const stats = await computeStorageStats(projectList);
      setStorageStats(stats);
    } catch (error) {
      console.error('Error loading projects:', error);
      setStorageStats(EMPTY_STATS);
    } finally {
      setStatsLoading(false);
    }
  }, [computeStorageStats]);

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
      await loadProjects();
    } catch (error) {
      setSheetMessage('Failed to create project');
      setShowErrorSheet(true);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEdit(true);
  };

  const handleUpdateProject = async (id: string, data: { name: string; client?: string; location?: string }) => {
    try {
      updateProject(id, data);
      await loadProjects();
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
      await loadProjects();
      
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

  const statCards: StatCardConfig[] = [
    {
      key: 'storage',
      label: 'Total Storage',
      value: statsLoading ? '—' : formatBytes(storageStats.totalSize),
      subtext: statsLoading ? 'Calculating…' : `${formatCount(storageStats.totalProjects)} projects`,
      icon: 'cloud-outline',
      accentColor: '#FF7A1A',
      accentBackground: 'rgba(255, 122, 26, 0.16)',
      accentBorder: 'rgba(255, 122, 26, 0.35)',
    },
    {
      key: 'photos',
      label: 'Photos',
      value: statsLoading ? '—' : formatCount(storageStats.totalPhotos),
      subtext: statsLoading ? 'Calculating…' : formatBytes(storageStats.photoSize),
      icon: 'camera-outline',
      accentColor: '#38BDF8',
      accentBackground: 'rgba(56, 189, 248, 0.16)',
      accentBorder: 'rgba(56, 189, 248, 0.35)',
    },
    {
      key: 'videos',
      label: 'Videos',
      value: statsLoading ? '—' : formatCount(storageStats.totalVideos),
      subtext: statsLoading ? 'Calculating…' : formatBytes(storageStats.videoSize),
      icon: 'videocam-outline',
      accentColor: '#A855F7',
      accentBackground: 'rgba(168, 85, 247, 0.16)',
      accentBorder: 'rgba(168, 85, 247, 0.35)',
    },
    {
      key: 'documents',
      label: 'Documents',
      value: statsLoading ? '—' : formatCount(storageStats.totalDocs),
      subtext: statsLoading ? 'Calculating…' : formatBytes(storageStats.docSize),
      icon: 'document-text-outline',
      accentColor: '#34D399',
      accentBackground: 'rgba(52, 211, 153, 0.16)',
      accentBorder: 'rgba(52, 211, 153, 0.35)',
    },
  ];


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
        right={
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              onPress={() => setShowFilterSheet(true)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: projectFilterCount > 0 ? 'rgba(255, 122, 26, 0.22)' : 'rgba(148, 163, 184, 0.18)',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: projectFilterCount > 0 ? 'rgba(255, 122, 26, 0.35)' : 'rgba(148, 163, 184, 0.28)',
              }}
            >
              <Ionicons name="filter" size={18} color={projectFilterCount > 0 ? '#FF7A1A' : '#94A3B8'} />
            </TouchableOpacity>
            {projectFilterCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#FF7A1A',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.2)'
              }}>
                <Text style={{ color: '#0B0F14', fontSize: 11, fontWeight: '700' }}>{projectFilterCount}</Text>
              </View>
            )}
          </View>
        }
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
            searchTerm={debouncedSearch}
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
        ListHeaderComponent={() => (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>Storage Snapshot</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>
                {statsLoading ? 'Calculating…' : 'Local device'}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
              {statCards.map((card, index) => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  subtext={card.subtext}
                  icon={card.icon}
                  accentColor={card.accentColor}
                  accentBackground={card.accentBackground}
                  accentBorder={card.accentBorder}
                  style={{ marginRight: index === statCards.length - 1 ? 0 : 12 }}
                />
              ))}
            </ScrollView>
          </View>
        )}
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
        style={{ position: 'absolute', right: 20, bottom: insets.bottom + FAB_BOTTOM_OFFSET }}
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

      {/* Filters & Sort Sheet */}
      <GlassActionSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        title="Filter & Sort"
        actions={[
          { label: `Sort: Newest first ${sortBy==='date_desc' ? '✓' : ''}`, onPress: () => setSortBy('date_desc') },
          { label: `Sort: Oldest first ${sortBy==='date_asc' ? '✓' : ''}`, onPress: () => setSortBy('date_asc') },
          { label: `Sort: Name A–Z ${sortBy==='name_asc' ? '✓' : ''}`, onPress: () => setSortBy('name_asc') },
          { label: `Sort: Client A–Z ${sortBy==='client_asc' ? '✓' : ''}`, onPress: () => setSortBy('client_asc') },
          { label: `Sort: Location A–Z ${sortBy==='location_asc' ? '✓' : ''}`, onPress: () => setSortBy('location_asc') },
          { label: `${hasNotesOnly ? '✓ ' : ''}Has notes only`, onPress: () => setHasNotesOnly(prev => !prev) },
        ]}
      />
    </View>
  );
}
