import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Organization,
  Project,
  getMediaByProject,
  getOrganizationsForCurrentUser,
  getProjects,
  getProjectsByOrganization,
} from '../../lib/db';
import { ensureProjectDir, deleteProjectDir } from '../../lib/files';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import { GlassCard, GlassTextInput, GlassModal, GlassActionSheet } from '../../components/glass';
import Animated from 'react-native-reanimated';
import { useScrollContext } from '../../components/glass/ScrollContext';
import EditProjectModal from '../../components/EditProjectModal';
import ProjectCard from '../../components/ProjectCard';
import { BVHeader, BVSearchBar, BVFloatingAction, BVEmptyState } from '../../components/ui';
import { WorkspaceSelection, getStoredWorkspace, isWorkspaceEqual, setStoredWorkspace } from '../../lib/workspace';
import {
  createProjectInSupabase,
  deleteProjectInSupabase,
  syncProjectsAndActivityFromSupabase,
  updateProjectInSupabase,
} from '../../lib/supabaseProjectsSync';

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

type CreateProjectForm = {
  name: string;
  client: string;
  location: string;
  organizationId: string | null;
  search: string;
  budget: string;
  startDate: string;
  endDate: string;
};

type DateParseResult = number | null | 'invalid';

const DEFAULT_CREATE_FORM: CreateProjectForm = {
  name: '',
  client: '',
  location: '',
  organizationId: null,
  search: '',
  budget: '',
  startDate: '',
  endDate: '',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSelection>({ type: 'personal' });
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<CreateProjectForm>(DEFAULT_CREATE_FORM);
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
  const organizationNameById = React.useMemo(() => {
    const mapping = new Map<string, string>();
    organizations.forEach((organization) => mapping.set(organization.id, organization.name));
    return mapping;
  }, [organizations]);
  
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
    const safeProjects = projects.filter(
      (project): project is Project =>
        !!project &&
        typeof project.id === 'string' &&
        project.id.trim().length > 0 &&
        typeof project.name === 'string'
    );
    const searchTerm = (debouncedSearch || '').toLowerCase();
    const filtered = safeProjects.filter(p => {
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

  const getPersonalProjects = useCallback((): Project[] => {
    return getProjects().filter((project) => !project.organization_id);
  }, []);

  const resolveWorkspace = useCallback((candidate: WorkspaceSelection, orgList: Organization[]): WorkspaceSelection => {
    if (candidate.type === 'organization') {
      const exists = orgList.some((organization) => organization.id === candidate.organizationId);
      if (exists) {
        return candidate;
      }
    }
    return { type: 'personal' };
  }, []);

  const loadProjectsForWorkspace = useCallback(async (nextWorkspace: WorkspaceSelection) => {
    const projectList =
      nextWorkspace.type === 'organization'
        ? getProjectsByOrganization(nextWorkspace.organizationId)
        : getPersonalProjects();

    setProjects(projectList);

    const stats = await computeStorageStats(projectList);
    setStorageStats(stats);
  }, [computeStorageStats, getPersonalProjects]);

  const loadProjects = useCallback(async () => {
    setStatsLoading(true);
    try {
      await syncProjectsAndActivityFromSupabase();
      const orgList = getOrganizationsForCurrentUser();
      const storedWorkspace = await getStoredWorkspace();
      const nextWorkspace = resolveWorkspace(storedWorkspace, orgList);

      if (!isWorkspaceEqual(storedWorkspace, nextWorkspace)) {
        await setStoredWorkspace(nextWorkspace);
      }

      setOrganizations(orgList);
      setWorkspace(nextWorkspace);
      setForm((prev) => ({
        ...prev,
        organizationId: nextWorkspace.type === 'organization' ? nextWorkspace.organizationId : null,
      }));

      await loadProjectsForWorkspace(nextWorkspace);
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
      setStorageStats(EMPTY_STATS);
    } finally {
      setStatsLoading(false);
    }
  }, [loadProjectsForWorkspace, resolveWorkspace]);

  const handleWorkspaceChange = async (nextWorkspace: WorkspaceSelection) => {
    setStatsLoading(true);
    try {
      const resolvedWorkspace = resolveWorkspace(nextWorkspace, organizations);
      setWorkspace(resolvedWorkspace);
      setForm((prev) => ({
        ...prev,
        organizationId: resolvedWorkspace.type === 'organization' ? resolvedWorkspace.organizationId : null,
      }));
      await setStoredWorkspace(resolvedWorkspace);
      await loadProjectsForWorkspace(resolvedWorkspace);
    } catch (error) {
      console.error('Error changing workspace:', error);
      setSheetMessage('Unable to switch workspace.');
      setShowErrorSheet(true);
    } finally {
      setStatsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  // Handle scroll events for dynamic header and tab bar
  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    'worklet';
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const handleCreateProject = async () => {
    if (isCreating) return;

    if (!form.name.trim()) {
      Alert.alert('Missing info', 'Project name is required');
      return;
    }

    const parsedStartDate = parseDateInput(form.startDate);
    if (parsedStartDate === 'invalid') {
      Alert.alert('Invalid date', 'Start Date must be valid (YYYY-MM-DD)');
      return;
    }

    const parsedEndDate = parseDateInput(form.endDate);
    if (parsedEndDate === 'invalid') {
      Alert.alert('Invalid date', 'End Date must be valid (YYYY-MM-DD)');
      return;
    }

    if (typeof parsedStartDate === 'number' && typeof parsedEndDate === 'number' && parsedEndDate < parsedStartDate) {
      Alert.alert('Invalid range', 'End Date cannot be before Start Date');
      return;
    }

    const parsedBudget = parseBudgetInput(form.budget);
    if (parsedBudget === 'invalid') {
      Alert.alert('Invalid budget', 'Budget must be a positive number');
      return;
    }

    setIsCreating(true);
    try {
      const rawOrganizationId = form.organizationId?.trim() || null;
      const organizationId =
        rawOrganizationId && UUID_REGEX.test(rawOrganizationId) ? rawOrganizationId : null;
      if (rawOrganizationId && !organizationId) {
        Alert.alert('Invalid workspace', 'Selected workspace is invalid. Switch workspace and try again.');
        return;
      }
      const project = await createProjectInSupabase({
        name: form.name.trim(),
        client: form.client.trim() || undefined,
        location: form.location.trim() || undefined,
        organization_id: organizationId,
        start_date: parsedStartDate,
        end_date: parsedEndDate,
        budget: parsedBudget,
      });

      await ensureProjectDir(project.id);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowCreate(false);
      setForm((prev) => ({
        ...DEFAULT_CREATE_FORM,
        search: prev.search,
        organizationId: workspace.type === 'organization' ? workspace.organizationId : null,
      }));
      await loadProjects();
    } catch (error) {
      const rawMessage =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to create project';
      const message =
        rawMessage.includes('row-level security policy for table "projects"')
          ? 'You do not have permission to create projects in this workspace. Switch to Personal workspace or ask an organization owner/admin to grant access.'
          : rawMessage;
      Alert.alert('Create failed', message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEdit(true);
  };

  const handleUpdateProject = async (
    id: string,
    data: {
      name: string;
      client?: string;
      location?: string;
      organization_id?: string | null;
      start_date?: number | null;
      end_date?: number | null;
      budget?: number | null;
    }
  ) => {
    try {
      await updateProjectInSupabase(id, data);
      await loadProjects();
      setShowEdit(false);
      setEditingProject(null);
    } catch {
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
        version: '1.0.3',
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
        version: '1.0.3',
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
      await deleteProjectInSupabase(selectedProject.id);
      
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

  const activeWorkspaceLabel =
    workspace.type === 'organization'
      ? organizationNameById.get(workspace.organizationId) || 'Organization'
      : 'Personal Workspace';

  const closeCreateModal = () => {
    setShowCreate(false);
  };

  const openCreateModal = () => {
    setForm((prev) => ({
      ...DEFAULT_CREATE_FORM,
      search: prev.search,
      organizationId: workspace.type === 'organization' ? workspace.organizationId : null,
    }));
    setShowCreate(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={{ paddingHorizontal: 16 }}>
        <BVHeader
          title="BuildVault"
          subtitle={activeWorkspaceLabel}
          right={
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => setShowFilterSheet(true)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: projectFilterCount > 0 ? 'rgba(58, 99, 243, 0.24)' : 'rgba(148, 163, 184, 0.18)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: projectFilterCount > 0 ? 'rgba(58, 99, 243, 0.4)' : 'rgba(148, 163, 184, 0.28)',
                }}
              >
                <Ionicons name="filter" size={18} color={projectFilterCount > 0 ? '#3A63F3' : '#94A3B8'} />
              </TouchableOpacity>
              {projectFilterCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: '#3A63F3',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.2)'
                }}>
                  <Text style={{ color: '#F1F5F9', fontSize: 11, fontWeight: '700' }}>{projectFilterCount}</Text>
                </View>
              )}
            </View>
          }
        />
        <BVSearchBar
          value={form.search || ''}
          onChangeText={(text) => setForm((prev) => ({ ...prev, search: text }))}
          placeholder="Search projects..."
          style={{ marginBottom: 10 }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12, paddingRight: 6 }}
        >
          <TouchableOpacity
            onPress={() => handleWorkspaceChange({ type: 'personal' })}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: workspace.type === 'personal' ? 'rgba(58, 99, 243, 0.4)' : 'rgba(148, 163, 184, 0.28)',
              backgroundColor: workspace.type === 'personal' ? 'rgba(58, 99, 243, 0.2)' : 'rgba(148, 163, 184, 0.12)',
              paddingHorizontal: 12,
              paddingVertical: 7,
              marginRight: 8,
            }}
          >
            <Text
              style={{
                color: workspace.type === 'personal' ? '#3A63F3' : '#CBD5E1',
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              Personal
            </Text>
          </TouchableOpacity>
          {organizations.map((organization) => {
            const selected = workspace.type === 'organization' && workspace.organizationId === organization.id;
            return (
              <TouchableOpacity
                key={organization.id}
                onPress={() => handleWorkspaceChange({ type: 'organization', organizationId: organization.id })}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? 'rgba(58, 99, 243, 0.4)' : 'rgba(148, 163, 184, 0.28)',
                  backgroundColor: selected ? 'rgba(58, 99, 243, 0.2)' : 'rgba(148, 163, 184, 0.12)',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
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
        </ScrollView>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={filteredProjects}
        keyExtractor={(item, index) => (typeof item?.id === 'string' && item.id ? item.id : `invalid-project-${index}`)}
        contentContainerStyle={{ 
          padding: 16, 
          paddingTop: 8,
          paddingBottom: insets.bottom + 100, // Tab bar + safe area
        }}
        renderItem={({ item }) => {
          if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
            return null;
          }
          return (
            <ProjectCard
              project={item}
              organizationLabel={
                item.organization_id
                  ? organizationNameById.get(item.organization_id) || 'Organization'
                  : 'Independent Project'
              }
              searchTerm={debouncedSearch}
              onPress={() => router.push(`/project/${item.id}`)}
              onLongPress={() => handleProjectOptions(item)}
            />
          );
        }}
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
          <BVEmptyState
            title="No projects yet"
            description="Create your first construction project to get started."
            icon="albums-outline"
            actionLabel="Create Project"
            onAction={openCreateModal}
            style={{ marginTop: 48 }}
          />
        )}
      />



      <BVFloatingAction
        icon="add"
        size={64}
        onPress={openCreateModal}
      />

      <GlassModal visible={showCreate} onRequestClose={closeCreateModal}>
        <ScrollView 
          style={{ maxHeight: '100%' }}
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="always"
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
                onSubmitEditing={handleCreateProject}
              />

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity
                  onPress={closeCreateModal}
                  style={{
                    flex: 1,
                    height: 62,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: 'rgba(148,163,184,0.32)',
                    backgroundColor: 'rgba(148,163,184,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#E2E8F0', fontSize: 22, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateProject}
                  disabled={!form.name.trim() || isCreating}
                  style={{
                    flex: 1,
                    height: 62,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: form.name.trim() && !isCreating ? 'rgba(255,122,26,0.42)' : 'rgba(148,163,184,0.22)',
                    backgroundColor: form.name.trim() && !isCreating ? 'rgba(255,122,26,0.16)' : 'rgba(148,163,184,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: form.name.trim() && !isCreating ? 1 : 0.6,
                  }}
                >
                  <Text style={{ color: '#FF7A1A', fontSize: 22, fontWeight: '700' }}>
                    {isCreating ? 'Creating...' : 'Create'}
                  </Text>
                </TouchableOpacity>
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
        organizations={organizations}
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
