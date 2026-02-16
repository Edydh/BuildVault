import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ActivityLogEntry, MediaItem, getProjectById, deleteMedia, Project, createMedia, Folder, getFoldersByProject, createFolder, updateFolderName, deleteFolder, getMediaByFolder, getMediaByProject, getMediaById, moveMediaToFolder, updateMediaNote, updateMediaThumbnail, getMediaFiltered, getActivityByProject, createActivity, updateActivity, deleteActivity } from '../../../lib/db';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { saveMediaToProject, getMediaType } from '../../../lib/files';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LazyImage from '../../../components/LazyImage';
import { ImageVariants, getImageVariants, checkImageVariantsExist, generateImageVariants, cleanupImageVariants } from '../../../lib/imageOptimization';
import NoteEncouragement from '../../../components/NoteEncouragement';
import { GlassCard, GlassTextInput, GlassButton, GlassModal, GlassActionSheet, ScrollProvider } from '../../../components/glass';
import { BVCard, BVEmptyState, BVFloatingAction } from '../../../components/ui';
import { FAB_BOTTOM_OFFSET } from '../../../components/glass/layout';
import { bvColors, bvFx } from '../../../lib/theme/tokens';
import Reanimated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle } from 'react-native-reanimated';

type IoniconName = keyof typeof Ionicons.glyphMap;
type ManualActivityType = 'material_purchase' | 'safety_inspection' | 'meeting_notes' | 'site_visit';

const MANUAL_ACTIVITY_OPTIONS: Array<{
  value: ManualActivityType;
  label: string;
  icon: IoniconName;
  color: string;
}> = [
  { value: 'material_purchase', label: 'Material', icon: 'cash-outline', color: bvColors.semantic.success },
  { value: 'safety_inspection', label: 'Safety', icon: 'clipboard-outline', color: bvColors.semantic.danger },
  { value: 'meeting_notes', label: 'Meeting', icon: 'document-text-outline', color: bvColors.brand.primaryLight },
  { value: 'site_visit', label: 'Site Visit', icon: 'car-outline', color: bvColors.brand.primaryLight },
];
const MANUAL_ACTIVITY_TYPES = new Set<ManualActivityType>(MANUAL_ACTIVITY_OPTIONS.map((option) => option.value));

function isManualActivityType(value: string): value is ManualActivityType {
  return MANUAL_ACTIVITY_TYPES.has(value as ManualActivityType);
}

function isImageThumbnailUri(uri?: string | null): boolean {
  if (!uri) return false;
  const normalized = uri.split('?')[0].toLowerCase();
  return normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.png') ||
    normalized.endsWith('.webp') ||
    normalized.endsWith('.heic');
}

function ProjectDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [projectMedia, setProjectMedia] = useState<MediaItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderModalMode, setFolderModalMode] = useState<'create' | 'edit'>('create');
  const [folderBeingEdited, setFolderBeingEdited] = useState<Folder | null>(null);
  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    actions?: { label: string; onPress: () => void; destructive?: boolean }[];
  }>({ visible: false });

  // Media filters (Phase 2)
  const [mediaFilters, setMediaFilters] = useState<{
    types: { photo: boolean; video: boolean; doc: boolean };
    hasNoteOnly: boolean;
    sortBy: 'date_desc'|'date_asc'|'name_asc'|'type_asc';
    dateFrom?: number | null;
    dateTo?: number | null;
  }>({
    types: { photo: true, video: true, doc: true },
    hasNoteOnly: false,
    sortBy: 'date_desc',
    dateFrom: null,
    dateTo: null,
  });
  const [showMediaFilterSheet, setShowMediaFilterSheet] = useState(false);
  const [preferDbFiltering, setPreferDbFiltering] = useState(false);
  const mediaActiveFilterCount = (
    (mediaFilters.hasNoteOnly ? 1 : 0) +
    ((!mediaFilters.types.photo || !mediaFilters.types.video || !mediaFilters.types.doc) ? 1 : 0) +
    ((mediaFilters.dateFrom || mediaFilters.dateTo) ? 1 : 0) +
    (mediaFilters.sortBy !== 'date_desc' ? 1 : 0)
  );

  // Load global performance preference
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@buildvault/use-db-filtering');
        if (raw) setPreferDbFiltering(raw === 'true');
      } catch {}
    })();
  }, []);

  // Create Animated components
  const AnimatedFlatList = Reanimated.createAnimatedComponent(FlatList);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const topOverlayHeight = headerHeight > 0 ? headerHeight : insets.top + 160;
  const headerOpacity = useSharedValue(1);
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));
  const scrollHandler = useAnimatedScrollHandler(({ contentOffset }) => {
    const offsetY = contentOffset.y;
    const fadeStart = 50;
    const fadeEnd = 150;
    if (offsetY <= fadeStart) {
      headerOpacity.value = 1;
      return;
    }

    const progress = Math.min((offsetY - fadeStart) / (fadeEnd - fadeStart), 1);
    headerOpacity.value = Math.max(0, 1 - progress);
  });
  
  // Note editing state
  const [editingNoteItem, setEditingNoteItem] = useState<MediaItem | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityModalMode, setActivityModalMode] = useState<'create' | 'edit'>('create');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [manualActivityType, setManualActivityType] = useState<ManualActivityType>('material_purchase');
  const [manualActivityDescription, setManualActivityDescription] = useState('');
  const [manualActivityAmount, setManualActivityAmount] = useState('');
  const [manualActivityReferenceId, setManualActivityReferenceId] = useState<string | null>(null);

  // Load saved view mode preference
  const loadViewModePreference = useCallback(async () => {
    try {
      const savedViewMode = await AsyncStorage.getItem('projectViewMode');
      if (savedViewMode && (savedViewMode === 'list' || savedViewMode === 'grid')) {
        setViewMode(savedViewMode);
      }
    } catch (error) {
      console.error('Error loading view mode preference:', error);
    }
  }, []);

  // Save view mode preference
  const saveViewModePreference = useCallback(async (mode: 'list' | 'grid') => {
    try {
      await AsyncStorage.setItem('projectViewMode', mode);
    } catch (error) {
      console.error('Error saving view mode preference:', error);
    }
  }, []);

  const loadData = useCallback((folderOverride?: string | null) => {
    if (!id) return;

    try {
      // Get project details
      const projectData = getProjectById(id);
      if (!projectData) {
        Alert.alert('Error', 'Project not found');
        router.back();
        return;
      }
      setProject(projectData);

      // Get folders for this project
      const projectFolders = getFoldersByProject(id);
      setFolders(projectFolders);

      // Get media for current folder (or root if no folder selected)
      const targetFolder = folderOverride !== undefined ? folderOverride : currentFolder;
      const mediaItems = getMediaByFolder(id, targetFolder);
      setMedia(mediaItems);
      setProjectMedia(getMediaByProject(id));

      // Recent activity feed (always scoped to full project, not folder)
      const activityItems = getActivityByProject(id, 12);
      setRecentActivity(activityItems);
      
      // Check for videos that need thumbnail regeneration
      const videosNeedingThumbnails = mediaItems.filter(item => 
        item.type === 'video' && 
        item.thumb_uri && 
        !isImageThumbnailUri(item.thumb_uri)
      );
      
      if (videosNeedingThumbnails.length > 0) {
        console.log(`Found ${videosNeedingThumbnails.length} videos needing thumbnail regeneration`);
        // Regenerate thumbnails in the background
        videosNeedingThumbnails.forEach(async (video) => {
          try {
            // First check if the video file exists and is readable
            const fileInfo = await FileSystem.getInfoAsync(video.uri);
            if (!fileInfo.exists || fileInfo.isDirectory || (fileInfo.size || 0) === 0) {
              console.warn(`Skipping thumbnail generation for video ${video.id}: file not accessible`);
              return;
            }

            const { generateSmartVideoThumbnail } = await import('../../../lib/media');
            const thumbnailResult = await generateSmartVideoThumbnail(video.uri, {
              quality: 0.9,
              width: 400,
              height: 400,
            });
            
            // Move thumbnail to project directory
            const thumbFilename = `thumb_${video.id}.jpg`;
            const mediaDir = `${FileSystem.documentDirectory}buildvault/${id}/media/`;
            const thumbFileUri = mediaDir + thumbFilename;

            await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });

            try {
              const existingThumb = await FileSystem.getInfoAsync(thumbFileUri);
              if (existingThumb.exists) {
                await FileSystem.deleteAsync(thumbFileUri, { idempotent: true });
              }
            } catch (cleanupError) {
              console.warn(`Could not cleanup old thumbnail for ${video.id}:`, cleanupError);
            }
            
            await FileSystem.moveAsync({
              from: thumbnailResult.uri,
              to: thumbFileUri,
            });

            updateMediaThumbnail(video.id, thumbFileUri);
            
            console.log(`Regenerated thumbnail for video ${video.id}: ${thumbFileUri}`);
          } catch (error) {
            console.error(`Failed to regenerate thumbnail for video ${video.id}:`, error);
            // Mark this video as having thumbnail issues to prevent repeated attempts
            console.warn(`Video ${video.id} will be skipped for future thumbnail generation attempts`);
          }
        });
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      Alert.alert('Error', 'Failed to load project data');
    }
  }, [id, router, currentFolder]);

  // Persist filters per project
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`@buildvault/media-filters/${id}`);
        if (raw) {
          const saved = JSON.parse(raw);
          setMediaFilters((prev) => ({ ...prev, ...saved }));
        }
      } catch {}
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        await AsyncStorage.setItem(`@buildvault/media-filters/${id}`,(JSON.stringify(mediaFilters)));
      } catch {}
    })();
  }, [id, mediaFilters]);

  // Derived filtered/sorted media
  const isLarge = media.length >= 300;
  const filteredMedia = React.useMemo(() => {
    const { types, hasNoteOnly, dateFrom, dateTo, sortBy } = mediaFilters;
    const allTypes = types.photo && types.video && types.doc;
    const hasActiveFilters = hasNoteOnly || !allTypes || !!dateFrom || !!dateTo || sortBy !== 'date_desc';
    if (hasActiveFilters && (preferDbFiltering || isLarge || currentFolder !== null)) {
      const selectedTypes: Array<MediaItem['type']> = [];
      if (types.photo) selectedTypes.push('photo');
      if (types.video) selectedTypes.push('video');
      if (types.doc) selectedTypes.push('doc');
      return getMediaFiltered(id!, {
        folderId: currentFolder === undefined ? undefined : currentFolder,
        types: selectedTypes.length === 3 ? undefined : selectedTypes,
        hasNoteOnly,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
      });
    }
    // Fallback to in-memory pipeline for small/default cases
    const filtered = media.filter((m) => {
      if (!types[m.type]) return false;
      if (hasNoteOnly && !(m.note && m.note.trim().length > 0)) return false;
      if (dateFrom && m.created_at < dateFrom) return false;
      if (dateTo && m.created_at > dateTo) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.note || a.uri).localeCompare(b.note || b.uri);
        case 'type_asc':
          return a.type.localeCompare(b.type);
        case 'date_asc':
          return a.created_at - b.created_at;
        case 'date_desc':
        default:
          return b.created_at - a.created_at;
      }
    });
    return sorted;
  }, [media, mediaFilters, currentFolder, id, preferDbFiltering, isLarge]);

  const mediaPreviewLimit = viewMode === 'grid' ? 12 : 8;
  const shouldCondenseMedia = !isSelectionMode && filteredMedia.length > mediaPreviewLimit;
  const visibleMedia = shouldCondenseMedia && !showAllMedia
    ? filteredMedia.slice(0, mediaPreviewLimit)
    : filteredMedia;

  useEffect(() => {
    setShowAllMedia(false);
  }, [
    id,
    currentFolder,
    viewMode,
    mediaFilters.types.photo,
    mediaFilters.types.video,
    mediaFilters.types.doc,
    mediaFilters.hasNoteOnly,
    mediaFilters.sortBy,
    mediaFilters.dateFrom,
    mediaFilters.dateTo,
  ]);

  // Load view mode preference when component mounts
  useEffect(() => {
    loadViewModePreference();
  }, [loadViewModePreference]);

  // Refresh data when returning from capture screen
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCaptureMedia = () => {
    const currentFolderName = currentFolder ? folders.find(f => f.id === currentFolder)?.name : 'All Media';
    
    Alert.alert(
      'Capture Media',
      `Choose media type\n\n📁 Will be saved to: ${currentFolderName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => {
            // Navigate to capture screen with photo mode and current folder
            router.push(`/project/${id}/capture?mode=photo&folderId=${currentFolder || ''}`);
          },
        },
        {
          text: 'Record Video',
          onPress: () => {
            // Navigate to capture screen with video mode and current folder
            router.push(`/project/${id}/capture?mode=video&folderId=${currentFolder || ''}`);
          },
        },
        {
          text: 'Upload Document',
          onPress: () => handleDocumentUpload(),
        },
      ]
    );
  };

  const handleDocumentUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const document = result.assets[0];
      
      // Determine the correct media type based on file extension
      const mediaType = getMediaType(document.name || document.uri);
      
      // Save document to project directory with correct type
      const { fileUri, thumbUri } = await saveMediaToProject(id!, document.uri, mediaType);
      
      // Save to database with correct type
      createMedia({
        project_id: id!,
        folder_id: currentFolder,
        type: mediaType,
        uri: fileUri,
        thumb_uri: thumbUri,
        note: `Uploaded: ${document.name}`,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      loadData();
      
      const fileTypeMessage = mediaType === 'photo' ? 'Image' : mediaType === 'video' ? 'Video' : 'Document';
      Alert.alert('Success', `${fileTypeMessage} uploaded successfully!`);
      
    } catch (error) {
      console.error('Document upload error:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    }
  };

  const handleShareProject = async () => {
    if (!project) return;

    Alert.alert(
      'Share Project',
      'How would you like to share this project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Summary Only',
          onPress: () => shareProjectSummary(),
        },
        {
          text: 'Share with Media Files',
          onPress: () => shareProjectWithMedia(),
        },
      ]
    );
  };

  const handleOpenPublicSettings = () => {
    if (!id) return;
    router.push(`/project/${id}/public`);
  };

  const shareProjectSummary = async () => {
    if (!project) return;
    
    try {
      // Create project summary data (metadata only)
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
        })),
        exportDate: new Date().toISOString(),
        version: '1.0.3',
        note: 'This is a project summary. Media files are not included.',
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

  const shareProjectWithMedia = async () => {
    if (!project) return;
    
    try {
      Alert.alert('Share with Media', 'Preparing project with all media files...', [], { cancelable: false });
      
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
      
      // Share all files together
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        // Share the first file (project info) and let user know about others
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

  const handleOpenActivityModal = () => {
    setActivityModalMode('create');
    setEditingActivityId(null);
    setManualActivityType('material_purchase');
    setManualActivityDescription('');
    setManualActivityAmount('');
    setManualActivityReferenceId(null);
    setShowActivityModal(true);
  };

  const handleCloseActivityModal = () => {
    setShowActivityModal(false);
    setActivityModalMode('create');
    setEditingActivityId(null);
    setManualActivityDescription('');
    setManualActivityAmount('');
    setManualActivityReferenceId(null);
  };

  const parseActivityAmount = (metadata: Record<string, unknown> | null): string => {
    if (!metadata) return '';
    if (typeof metadata.amount === 'number' && Number.isFinite(metadata.amount)) {
      return String(metadata.amount);
    }
    if (typeof metadata.amount === 'string') {
      const parsed = Number(metadata.amount);
      return Number.isFinite(parsed) ? String(parsed) : '';
    }
    return '';
  };

  const handleEditActivityPress = (entry: {
    id: string;
    actionType: string;
    metadataRaw: string | null;
    referenceId: string | null;
  }) => {
    if (!isManualActivityType(entry.actionType)) {
      return;
    }

    const metadata = parseActivityMetadata(entry.metadataRaw);
    const description = typeof metadata?.description === 'string' ? metadata.description.trim() : '';

    setActivityModalMode('edit');
    setEditingActivityId(entry.id);
    setManualActivityType(entry.actionType);
    setManualActivityDescription(description);
    setManualActivityAmount(parseActivityAmount(metadata));
    setManualActivityReferenceId(entry.referenceId);
    setShowActivityModal(true);
  };

  const handleDeleteActivityPress = (entry: { id: string }) => {
    setActionSheet({
      visible: true,
      title: 'Delete Activity',
      message: 'This activity will be permanently removed from the timeline.',
      actions: [
        {
          label: 'Delete Activity',
          destructive: true,
          onPress: () => {
            try {
              deleteActivity(entry.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              loadData();
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Error', 'Could not delete activity. Please try again.');
            }
          },
        },
      ],
    });
  };

  const handleActivityCardPress = (entry: {
    id: string;
    actionType: string;
    metadataRaw: string | null;
    referenceId: string | null;
    canManage: boolean;
  }) => {
    if (!entry.canManage) return;

    setActionSheet({
      visible: true,
      title: 'Activity Options',
      message: 'Manage this timeline entry.',
      actions: [
        {
          label: 'Edit Activity',
          onPress: () => handleEditActivityPress(entry),
        },
        {
          label: 'Delete Activity',
          destructive: true,
          onPress: () => handleDeleteActivityPress(entry),
        },
      ],
    });
  };

  const handleSaveActivity = () => {
    if (!id) return;

    const description = manualActivityDescription.trim();
    if (!description) {
      Alert.alert('Missing details', 'Please add a short description for this activity.');
      return;
    }

    let amount: number | null = null;
    if (manualActivityType === 'material_purchase' && manualActivityAmount.trim().length > 0) {
      const parsedAmount = Number(manualActivityAmount.replace(/,/g, '').trim());
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        Alert.alert('Invalid amount', 'Enter a valid purchase amount.');
        return;
      }
      amount = parsedAmount;
    }

    try {
      if (activityModalMode === 'edit') {
        if (!editingActivityId) {
          Alert.alert('Error', 'No activity selected to edit.');
          return;
        }
        updateActivity(editingActivityId, {
          actionType: manualActivityType,
          referenceId: manualActivityReferenceId,
          metadata: {
            description,
            amount,
          },
        });
      } else {
        createActivity(id, manualActivityType, manualActivityReferenceId, {
          description,
          amount,
        });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handleCloseActivityModal();
      loadData();
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', activityModalMode === 'edit' ? 'Could not update activity. Please try again.' : 'Could not add activity. Please try again.');
    }
  };

  const handleDeleteMedia = (mediaItem: MediaItem) => {
    const mediaTypeName = mediaItem.type === 'photo' ? 'photo' : 
                         mediaItem.type === 'video' ? 'video' : 'document';
    
    setActionSheet({
      visible: true,
      title: 'Delete Media',
      message: `Are you sure you want to delete this ${mediaTypeName}? This action cannot be undone.`,
      actions: [
        {
          label: 'Delete',
          destructive: true,
          onPress: async () => {
            try {
              const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(mediaItem.uri, { idempotent: true });
              }
              if (mediaItem.thumb_uri) {
                const thumbInfo = await FileSystem.getInfoAsync(mediaItem.thumb_uri);
                if (thumbInfo.exists) {
                  await FileSystem.deleteAsync(mediaItem.thumb_uri, { idempotent: true });
                }
              }
              if (mediaItem.type === 'photo' && id) {
                await cleanupImageVariants(mediaItem.id, id);
              }
              deleteMedia(mediaItem.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              loadData();
            } catch (error) {
              console.error('Error deleting media:', error);
            }
          },
        },
      ],
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatRelativeTime = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return 'Just now';
    if (diffMs < hour) {
      const value = Math.max(1, Math.floor(diffMs / minute));
      return `${value} min ago`;
    }
    if (diffMs < day) {
      const value = Math.floor(diffMs / hour);
      return `${value}h ago`;
    }
    if (diffMs < 7 * day) {
      const value = Math.floor(diffMs / day);
      return `${value}d ago`;
    }
    return new Date(timestamp).toLocaleDateString();
  };

  const parseActivityMetadata = (metadata: string | null | undefined): Record<string, unknown> | null => {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>;
      return parsed;
    } catch {
      return null;
    }
  };

  const resolveActivityReferenceId = (entry: ActivityLogEntry): string | null => {
    if (typeof entry.reference_id === 'string' && entry.reference_id.trim().length > 0) {
      return entry.reference_id.trim();
    }
    const metadata = parseActivityMetadata(entry.metadata);
    if (!metadata) return null;
    if (typeof metadata.reference_id === 'string' && metadata.reference_id.trim().length > 0) {
      return metadata.reference_id.trim();
    }
    if (typeof metadata.media_id === 'string' && metadata.media_id.trim().length > 0) {
      return metadata.media_id.trim();
    }
    return null;
  };

  const openLinkedMediaFromActivity = (mediaId: string) => {
    if (!id) return;
    const localMedia = projectMedia.find((item) => item.id === mediaId) ?? getMediaById(mediaId);
    if (!localMedia) {
      Alert.alert('Linked file unavailable', 'This activity references media that is no longer available.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/project/${id}/media/${localMedia.id}`);
  };

  const mapActivityPresentation = (
    entry: ActivityLogEntry
  ): {
    title: string;
    description: string;
    icon: IoniconName;
    iconBg: string;
    iconColor: string;
    expandable: boolean;
  } => {
    const metadata = parseActivityMetadata(entry.metadata);
    const type = typeof metadata?.type === 'string' ? metadata.type : '';
    const metadataDescription = typeof metadata?.description === 'string'
      ? metadata.description.trim()
      : '';
    const metadataAmount = typeof metadata?.amount === 'number'
      ? metadata.amount
      : typeof metadata?.amount === 'string'
        ? Number(metadata.amount)
        : null;
    const metadataEmail = typeof metadata?.email === 'string' ? metadata.email.trim() : '';
    const metadataName = typeof metadata?.name === 'string' ? metadata.name.trim() : '';
    const metadataRole = typeof metadata?.role === 'string' ? metadata.role.trim() : '';
    const metadataFromRole = typeof metadata?.from_role === 'string' ? metadata.from_role.trim() : '';
    const metadataToRole = typeof metadata?.to_role === 'string' ? metadata.to_role.trim() : '';
    const metadataFromStatus = typeof metadata?.from_status === 'string' ? metadata.from_status.trim() : '';
    const metadataToStatus = typeof metadata?.to_status === 'string' ? metadata.to_status.trim() : '';
    const folderName = typeof metadata?.name === 'string'
      ? metadata.name
      : typeof metadata?.to === 'string'
        ? metadata.to
        : 'folder';
    const formatRoleLabel = (rawRole: string): string => {
      if (!rawRole) return 'Team Member';
      return rawRole.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    };
    const formatStatusLabel = (rawStatus: string): string => {
      if (!rawStatus) return 'Status';
      return rawStatus.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    };

    switch (entry.action_type) {
      case 'project_created':
        return {
          title: 'Project created',
          description: 'Initial project setup completed.',
          icon: 'sparkles',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'project_updated':
        return {
          title: 'Project details updated',
          description: 'Core project information was edited.',
          icon: 'create-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'media_added':
        return {
          title: type === 'photo' ? 'Site Progress Photos' : type ? `${type.charAt(0).toUpperCase()} Added` : 'Media Added',
          description: type === 'photo'
            ? 'New site progress photos were added to the timeline.'
            : 'New file captured or uploaded to this project.',
          icon: type === 'video' ? 'videocam' : type === 'doc' ? 'document-text' : 'camera',
          iconBg: type === 'photo' ? bvColors.semantic.warning : bvColors.semantic.success,
          iconColor: bvColors.neutral[0],
          expandable: type === 'photo',
        };
      case 'media_deleted':
        return {
          title: 'Media removed',
          description: 'A file was deleted from this project.',
          icon: 'trash-outline',
          iconBg: bvColors.semantic.danger,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'note_added':
        return {
          title: 'Note added',
          description: 'A note was attached to a media item.',
          icon: 'document-text-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'note_updated':
        return {
          title: 'Note updated',
          description: 'A media note was edited.',
          icon: 'create-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'note_removed':
        return {
          title: 'Note removed',
          description: 'A media note was removed.',
          icon: 'remove-circle-outline',
          iconBg: bvColors.semantic.danger,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'folder_created':
        return {
          title: 'Folder created',
          description: `Folder "${folderName}" added.`,
          icon: 'folder-open-outline',
          iconBg: bvColors.semantic.warning,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'folder_renamed':
        return {
          title: 'Folder renamed',
          description: `Folder renamed to "${folderName}".`,
          icon: 'create-outline',
          iconBg: bvColors.semantic.warning,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'folder_deleted':
        return {
          title: 'Folder deleted',
          description: `Folder "${folderName}" removed.`,
          icon: 'folder-outline',
          iconBg: bvColors.semantic.danger,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'media_moved':
        return {
          title: 'Media moved',
          description: 'A file was moved between folders.',
          icon: 'swap-horizontal-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'material_purchase':
        return {
          title: 'Material Purchase',
          description: metadataAmount && Number.isFinite(metadataAmount) && metadataAmount > 0
            ? `${metadataDescription || 'Materials purchased'} - ${formatCurrency(metadataAmount)}`
            : metadataDescription || 'Materials purchase logged.',
          icon: 'cash-outline',
          iconBg: bvColors.semantic.success,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'safety_inspection':
        return {
          title: 'Safety Inspection',
          description: metadataDescription || 'Safety inspection was logged.',
          icon: 'clipboard-outline',
          iconBg: bvColors.semantic.danger,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'meeting_notes':
        return {
          title: 'Meeting Notes',
          description: metadataDescription || 'Meeting notes were added.',
          icon: 'document-text-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'site_visit':
        return {
          title: 'Site Visit',
          description: metadataDescription || 'Site visit was logged.',
          icon: 'car-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'member_invited':
        return {
          title: 'Member Invited',
          description: metadataEmail
            ? `Invitation sent to ${metadataEmail} as ${formatRoleLabel(metadataRole)}.`
            : `Team invitation sent as ${formatRoleLabel(metadataRole)}.`,
          icon: 'person-add-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'invite_accepted':
        return {
          title: 'Invite Accepted',
          description: metadataName
            ? `${metadataName} joined as ${formatRoleLabel(metadataRole)}.`
            : `A team member joined as ${formatRoleLabel(metadataRole)}.`,
          icon: 'checkmark-done-circle-outline',
          iconBg: bvColors.semantic.success,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'member_added':
        return {
          title: 'Member Added',
          description: metadataName
            ? `${metadataName} was added as ${formatRoleLabel(metadataRole)}.`
            : `A member was added as ${formatRoleLabel(metadataRole)}.`,
          icon: 'person-add-outline',
          iconBg: bvColors.semantic.success,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'member_role_updated':
        return {
          title: 'Member Role Updated',
          description: metadataName
            ? `${metadataName}: ${formatRoleLabel(metadataFromRole)} -> ${formatRoleLabel(metadataToRole)}.`
            : `Role updated: ${formatRoleLabel(metadataFromRole)} -> ${formatRoleLabel(metadataToRole)}.`,
          icon: 'swap-horizontal-outline',
          iconBg: bvColors.semantic.warning,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'member_status_updated':
        return {
          title: 'Member Status Updated',
          description: metadataName
            ? `${metadataName}: ${formatStatusLabel(metadataFromStatus)} -> ${formatStatusLabel(metadataToStatus)}.`
            : `Member status changed: ${formatStatusLabel(metadataFromStatus)} -> ${formatStatusLabel(metadataToStatus)}.`,
          icon: 'pulse-outline',
          iconBg: bvColors.semantic.warning,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'member_removed':
        return {
          title: 'Member Removed',
          description: metadataName
            ? `${metadataName} was removed from this project.`
            : 'A team member was removed from this project.',
          icon: 'person-remove-outline',
          iconBg: bvColors.semantic.danger,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'project_published':
        return {
          title: 'Project Published',
          description: 'Public profile is now visible in the feed.',
          icon: 'globe-outline',
          iconBg: bvColors.semantic.success,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'project_unpublished':
        return {
          title: 'Project Unpublished',
          description: 'Project was switched back to private visibility.',
          icon: 'lock-closed-outline',
          iconBg: bvColors.semantic.warning,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      case 'project_public_profile_updated':
        return {
          title: 'Public Profile Updated',
          description: 'Marketing summary details were updated.',
          icon: 'create-outline',
          iconBg: bvColors.brand.primaryLight,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
      default:
        return {
          title: 'Project event',
          description: metadataDescription || 'A project activity was recorded.',
          icon: 'pulse-outline',
          iconBg: bvColors.text.muted,
          iconColor: bvColors.neutral[0],
          expandable: false,
        };
    }
  };

  // Multi-select functions
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllItems = () => {
    setSelectedItems(new Set(media.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const toggleViewMode = () => {
    const newViewMode = viewMode === 'list' ? 'grid' : 'list';
    setViewMode(newViewMode);
    saveViewModePreference(newViewMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Folder management functions
  const resetFolderForm = () => {
    setFolderModalMode('create');
    setFolderBeingEdited(null);
    setNewFolderName('');
  };

  const closeFolderModal = () => {
    setShowFolderModal(false);
    resetFolderForm();
  };

  const openCreateFolderModal = () => {
    resetFolderForm();
    setShowFolderModal(true);
  };

  const startRenameFolder = (folder: Folder) => {
    setFolderModalMode('edit');
    setFolderBeingEdited(folder);
    setNewFolderName(folder.name);
    setShowFolderModal(true);
  };

  const handleFolderSubmit = () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      if (folderModalMode === 'edit' && folderBeingEdited) {
        const folderId = folderBeingEdited.id;
        updateFolderName(folderId, trimmedName);
        setFolders(prev =>
          prev.map(folder =>
            folder.id === folderId ? { ...folder, name: trimmedName } : folder
          )
        );
        closeFolderModal();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Success', 'Folder renamed successfully!');
        loadData(folderId);
      } else {
        const folder = createFolder({
          project_id: id!,
          name: trimmedName,
        });
        setFolders(prev => [...prev, folder]);
        closeFolderModal();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert('Success', 'Folder created successfully!');
        loadData(currentFolder ?? null);
      }
    } catch (error) {
      console.error('Error saving folder:', error);
      Alert.alert('Error', folderModalMode === 'edit' ? 'Failed to rename folder' : 'Failed to create folder');
    }
  };

  const confirmDeleteFolder = (folder: Folder) => {
    setActionSheet({
      visible: true,
      title: `Delete "${folder.name}"`,
      message: 'All media in this folder will be moved back to All Media.',
      actions: [
        {
          label: 'Delete Folder',
          destructive: true,
          onPress: () => executeDeleteFolder(folder),
        },
      ],
    });
  };

  const executeDeleteFolder = (folder: Folder) => {
    try {
      deleteFolder(folder.id);
      setFolders(prev => prev.filter(f => f.id !== folder.id));

      const nextFolder = currentFolder === folder.id ? null : currentFolder;
      if (currentFolder === folder.id) {
        setCurrentFolder(null);
      }

      loadData(nextFolder ?? null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Success', 'Folder deleted successfully!');
    } catch (error) {
      console.error('Error deleting folder:', error);
      Alert.alert('Error', 'Failed to delete folder');
    }
  };

  const handleSelectFolder = (folderId: string | null) => {
    setCurrentFolder(folderId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData(folderId ?? null);
  };

  const openFolderOptions = (folder: Folder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionSheet({
      visible: true,
      title: folder.name,
      actions: [
        {
          label: 'Rename Folder',
          onPress: () => startRenameFolder(folder),
        },
        {
          label: 'Delete Folder',
          destructive: true,
          onPress: () => confirmDeleteFolder(folder),
        },
      ],
    });
  };

  const handleMoveMedia = (mediaItem: MediaItem) => {
    const actions = [
      {
        label: 'All Media',
        onPress: () => {
          try {
            moveMediaToFolder(mediaItem.id, null);
            loadData();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            console.error('Error moving media:', error);
          }
        },
      },
      ...folders.map(folder => ({
        label: folder.name,
        onPress: () => {
          try {
            moveMediaToFolder(mediaItem.id, folder.id);
            loadData();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            console.error('Error moving media:', error);
          }
        },
      })),
    ];
    setActionSheet({ visible: true, title: 'Move Media', actions });
  };

  const handleShareSelected = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one item to share.');
      return;
    }

    const selectedMedia = media.filter(item => selectedItems.has(item.id));
    
    if (selectedMedia.length === 1) {
      // Single file sharing - direct approach
      try {
        const mediaItem = selectedMedia[0];
        const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
        if (fileInfo.exists) {
                  await Sharing.shareAsync(mediaItem.uri, {
          mimeType: mediaItem.type === 'photo' ? 'image/jpeg' : 
                   mediaItem.type === 'video' ? 'video/mp4' : 'application/pdf',
          dialogTitle: `Share ${mediaItem.type}`,
          // Ensure no compression during sharing
          UTI: mediaItem.type === 'photo' ? 'public.jpeg' : 
               mediaItem.type === 'video' ? 'public.mpeg-4' : 'public.pdf',
        });
        } else {
          Alert.alert('Error', 'File not found. Please try again.');
        }
      } catch (error) {
        console.error('Error sharing single file:', error);
        Alert.alert('Error', 'Failed to share file. Please try again.');
      }
    } else {
      // Multiple files - share all at once via text messages
      await shareMultipleFilesViaText(selectedMedia);
    }
    
    // Exit selection mode
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  };

  const shareMultipleFilesViaText = async (mediaItems: MediaItem[]) => {
    try {
      // For Messages app, we need to share files individually
      // This allows the user to select the same recipient for each file
      
      Alert.alert(
        'Share Multiple Files via Messages',
        `You've selected ${mediaItems.length} files to share.\n\nThis will open Messages ${mediaItems.length} times. For each file:\n1. Select the same recipient\n2. Send the message\n3. Repeat for the next file\n\nThis way all files go to the same conversation!`,
        [
          { 
            text: 'Start Sharing', 
            onPress: () => shareFilesSequentially(mediaItems)
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error preparing files for text sharing:', error);
      Alert.alert('Error', 'Failed to prepare files for sharing. Please try again.');
    }
  };

  const shareFilesSequentially = async (mediaItems: MediaItem[]) => {
    try {
      for (let i = 0; i < mediaItems.length; i++) {
        const mediaItem = mediaItems[i];
        const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
        
        if (fileInfo.exists) {
          // Show progress before sharing each file
          if (i === 0) {
            Alert.alert(
              'Sharing Files',
              `Ready to share ${mediaItems.length} files via Messages.\n\nFor each file, select the same recipient to send all files to the same conversation.`,
              [{ text: 'Start', onPress: () => shareNextFile(mediaItems, 0) }]
            );
            return; // Exit here, shareNextFile will handle the rest
          }
        }
      }
    } catch (error) {
      console.error('Error sharing files sequentially:', error);
      Alert.alert('Error', 'Failed to share some files. Please try again.');
    }
  };

  const shareNextFile = async (mediaItems: MediaItem[], index: number) => {
    if (index >= mediaItems.length) {
      Alert.alert('Success', `Successfully shared ${mediaItems.length} files!`);
      return;
    }

    const mediaItem = mediaItems[index];
    const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
    
    if (fileInfo.exists) {
      try {
        await Sharing.shareAsync(mediaItem.uri, {
          mimeType: mediaItem.type === 'photo' ? 'image/jpeg' : 
                   mediaItem.type === 'video' ? 'video/mp4' : 'application/pdf',
          dialogTitle: `Share ${mediaItem.type} (${index + 1} of ${mediaItems.length})`,
          // Ensure no compression during sharing
          UTI: mediaItem.type === 'photo' ? 'public.jpeg' : 
               mediaItem.type === 'video' ? 'public.mpeg-4' : 'public.pdf',
        });
        
        // After sharing, show option to continue with next file
        if (index < mediaItems.length - 1) {
          Alert.alert(
            'Continue Sharing',
            `File ${index + 1} of ${mediaItems.length} shared!\n\nReady to share the next file?`,
            [
              { 
                text: 'Share Next', 
                onPress: () => shareNextFile(mediaItems, index + 1)
              },
              { text: 'Done', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Success', `Successfully shared all ${mediaItems.length} files!`);
        }
      } catch (error) {
        console.error('Error sharing file:', error);
        Alert.alert('Error', `Failed to share file ${index + 1}. Continue with next file?`, [
          { 
            text: 'Continue', 
            onPress: () => shareNextFile(mediaItems, index + 1)
          },
          { text: 'Stop', style: 'cancel' }
        ]);
      }
    } else {
      Alert.alert('Error', `File ${index + 1} not found. Continue with next file?`, [
        { 
          text: 'Continue', 
          onPress: () => shareNextFile(mediaItems, index + 1)
        },
        { text: 'Stop', style: 'cancel' }
      ]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one item to delete.');
      return;
    }

    const selectedMedia = media.filter(item => selectedItems.has(item.id));
    const mediaTypes = [...new Set(selectedMedia.map(item => item.type))];
    const typeText = mediaTypes.length === 1 ? 
      `${mediaTypes[0]}${selectedItems.size > 1 ? 's' : ''}` : 
      'items';

    Alert.alert(
      'Delete Selected Items',
      `Are you sure you want to delete ${selectedItems.size} selected ${typeText}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const mediaItem of selectedMedia) {
                // Delete the physical file from file system
                const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
                if (fileInfo.exists) {
                  await FileSystem.deleteAsync(mediaItem.uri, { idempotent: true });
                }
                
                // Delete thumbnail if it exists
                if (mediaItem.thumb_uri) {
                  const thumbInfo = await FileSystem.getInfoAsync(mediaItem.thumb_uri);
                  if (thumbInfo.exists) {
                    await FileSystem.deleteAsync(mediaItem.thumb_uri, { idempotent: true });
                  }
                }
                
                // Delete from database
                deleteMedia(mediaItem.id);
              }
              
              // Provide haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              // Refresh the media list
              loadData();
              
              // Exit selection mode
              setIsSelectionMode(false);
              setSelectedItems(new Set());
              
              Alert.alert('Success', `${selectedItems.size} ${typeText} deleted successfully!`);
              
            } catch (error) {
              console.error('Error deleting selected items:', error);
              Alert.alert('Error', 'Failed to delete selected items. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Note editing functions
  const handleAddNote = (item: MediaItem) => {
    setEditingNoteItem(item);
    setNoteText(item.note || '');
    setShowNoteModal(true);
  };

  const handleSaveNote = () => {
    if (!editingNoteItem) return;
    
    try {
      updateMediaNote(editingNoteItem.id, noteText || null);
      
      // Update the local state
      setMedia(prev => prev.map(item => 
        item.id === editingNoteItem.id ? { ...item, note: noteText || null } : item
      ));
      
      // Close modal
      setShowNoteModal(false);
      setEditingNoteItem(null);
      setNoteText('');
      
      // Show success message
      setActionSheet({
        visible: true,
        title: 'Success',
        message: 'Note saved successfully!',
        actions: [{ label: 'OK', onPress: () => setActionSheet({ visible: false }) }]
      });
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error saving note:', error);
      setActionSheet({
        visible: true,
        title: 'Error',
        message: 'Failed to save note. Please try again.',
        actions: [{ label: 'OK', onPress: () => setActionSheet({ visible: false }) }]
      });
    }
  };

  const handleCancelNote = () => {
    setShowNoteModal(false);
    setEditingNoteItem(null);
    setNoteText('');
  };

  const MediaCardGrid = ({ item }: { item: MediaItem }) => {
    const isSelected = selectedItems.has(item.id);
    const [variants, setVariants] = useState<ImageVariants | null>(null);
    const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
    const [videoThumbnail, setVideoThumbnail] = useState<string | null>(item.thumb_uri || null);
    
    // Load image variants for photos
    useEffect(() => {
      const loadVariants = async () => {
        if (item.type !== 'photo' || !id) return;

        try {
          // Check if variants already exist
          const variantsExist = await checkImageVariantsExist(item.id, id);
          
          if (variantsExist) {
            // Load existing variants
            const existingVariants = await getImageVariants(item.id, id, item.uri);
            setVariants(existingVariants);
          } else {
            // Generate new variants in the background
            setIsGeneratingVariants(true);
            const newVariants = await generateImageVariants(item.uri, id, item.id);
            setVariants(newVariants);
            setIsGeneratingVariants(false);
          }
        } catch (error) {
          console.error('Error loading image variants:', error);
          // Fallback to original URI
          setVariants({
            original: item.uri,
            full: item.uri,
            preview: item.uri,
            thumbnail: item.uri,
          });
          setIsGeneratingVariants(false);
        }
      };

      loadVariants();

      if (item.type === 'video' && id) {
        let active = true;
        const ensureVideoThumb = async () => {
          try {
            let currentThumb = item.thumb_uri || null;

            if (currentThumb) {
              const info = await FileSystem.getInfoAsync(currentThumb);
              if (!info.exists || !isImageThumbnailUri(currentThumb)) {
                currentThumb = null;
              }
            }

            if (!currentThumb) {
              // First check if the video file exists and is readable
              const fileInfo = await FileSystem.getInfoAsync(item.uri);
              if (!fileInfo.exists || fileInfo.isDirectory || (fileInfo.size || 0) === 0) {
                console.warn(`Skipping thumbnail generation for video ${item.id}: file not accessible`);
                if (active) {
                  setVideoThumbnail(null);
                }
                return;
              }

              const { generateSmartVideoThumbnail } = await import('../../../lib/media');
              const result = await generateSmartVideoThumbnail(item.uri, {
                quality: 0.8,
                width: 600,
                height: 600,
              });

              const thumbFilename = `thumb_${item.id}.jpg`;
              const mediaDir = `${FileSystem.documentDirectory}buildvault/${id}/media/`;

              await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });

              const targetUri = `${mediaDir}${thumbFilename}`;

              try {
                const existingTarget = await FileSystem.getInfoAsync(targetUri);
                if (existingTarget.exists) {
                  await FileSystem.deleteAsync(targetUri, { idempotent: true });
                }
              } catch (error) {
                console.warn('Unable to cleanup existing grid thumbnail target:', error);
              }

              await FileSystem.moveAsync({ from: result.uri, to: targetUri });
              updateMediaThumbnail(item.id, targetUri);
              currentThumb = targetUri;
            }

            if (active) {
              setVideoThumbnail(currentThumb);
            }
          } catch (error) {
            console.error('Failed to prepare video thumbnail (grid view):', error);
            if (active) {
              setVideoThumbnail(null);
            }
          }
        };

        ensureVideoThumb();

        return () => {
          active = false;
        };
      }

      return undefined;
    }, [item.id, item.uri, item.type, item.thumb_uri, id]);
    const handlePress = () => {
      if (isSelectionMode) {
        toggleItemSelection(item.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        if (item.type === 'photo') {
          // For photos, find the index and navigate to gallery
          const photoIndex = media.filter(m => m.type === 'photo').findIndex(m => m.id === item.id);
          const folderQueryParam = `&folderId=${encodeURIComponent(currentFolder ?? '')}`;
          router.push(`/project/${id}/gallery?initialIndex=${photoIndex}${folderQueryParam}`);
        } else {
          // For videos and documents, navigate to media detail
          router.push(`/project/${id}/media/${item.id}`);
        }
      }
    };

    return (
      <GlassCard
        style={{
          width: '48%', // Two columns with gap
          aspectRatio: 1, // Square aspect ratio
          marginBottom: 8,
          backgroundColor: isSelected ? bvFx.selectionSoft : undefined,
          borderWidth: isSelected ? 1 : 0,
          borderColor: isSelected ? bvColors.interactive.selected : 'transparent',
        }}
        intensity={60}
        shadowEnabled={true}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 8,
          }}
          onPress={handlePress}
          onLongPress={() => {
            if (!isSelectionMode) {
              Alert.alert(
                'Media Options',
                'What would you like to do with this media?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Move to Folder',
                    onPress: () => handleMoveMedia(item),
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteMedia(item),
                  },
                ]
              );
            }
          }}
          activeOpacity={0.7}
        >
        <View style={{ flex: 1, position: 'relative' }}>
          {isSelectionMode && (
            <View style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: isSelected ? bvColors.interactive.selected : bvColors.text.tertiary,
              backgroundColor: isSelected ? bvColors.interactive.selected : 'transparent',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2,
            }}>
              {isSelected && (
                <Ionicons name="checkmark" size={12} color={bvColors.neutral[0]} />
              )}
            </View>
          )}
          
          {/* Media Preview */}
          <View style={{
            flex: 1,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: bvColors.surface.muted,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {item.type === 'photo' ? (
              variants ? (
                <LazyImage
                  variants={variants}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  contentFit="cover"
                  progressiveLoading={Platform.OS !== 'android'}
                  priority="normal"
                />
              ) : (
                <ExpoImage
                  source={{ uri: item.uri }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  contentFit="cover"
                  transition={200}
                />
              )
            ) : item.type === 'video' ? (
              <View style={{ flex: 1, width: '100%', position: 'relative' }}>
                {videoThumbnail ? (
                  <>
                    <Image
                      source={{ uri: videoThumbnail }}
                      style={{
                        width: '100%',
                        height: '100%',
                      }}
                      resizeMode="cover"
                      onError={() => {
                        setVideoThumbnail(null);
                      }}
                    />
                    {/* Glass overlay for video preview effect */}
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: bvFx.blackTint10,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      {/* Large centered play button */}
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: bvFx.blackTint60,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: bvColors.surface.shadow,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 5,
                      }}>
                        <Ionicons name="play" size={20} color={bvColors.neutral[0]} />
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: bvColors.surface.muted }}>
                    <Ionicons name="videocam" size={32} color={bvColors.brand.accent} />
                    <Text style={{ color: bvColors.text.muted, fontSize: 10, marginTop: 4 }}>Loading...</Text>
                  </View>
                )}
                {/* Video duration badge */}
                <View style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: bvFx.blackTint80,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <Ionicons name="time" size={10} color={bvColors.neutral[0]} />
                  <Text style={{ color: bvColors.neutral[0], fontSize: 9, fontWeight: '600', marginLeft: 2 }}>
                    --:--
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="document" size={32} color={bvColors.brand.accent} />
              </View>
            )}
          </View>
          
          {/* Type Badge */}
          <View style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: bvFx.blackTint70,
            borderRadius: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Ionicons
              name={
                item.type === 'photo' ? 'image' :
                item.type === 'video' ? 'videocam' : 'document'
              }
              size={12}
              color={bvColors.neutral[0]}
            />
            <Text style={{ color: bvColors.neutral[0], fontSize: 10, fontWeight: '600' }}>
              {item.type.toUpperCase()}
            </Text>
          </View>

          {/* Loading indicator for image variants generation */}
          {isGeneratingVariants && (
            <View style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: bvFx.accentSoftStrong,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: bvColors.surface.inverse,
              }} />
            </View>
          )}
          
          <Text style={{ 
            color: bvColors.text.primary, 
            fontSize: 14, 
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: 4,
          }}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </Text>
          
          <Text style={{ 
            color: bvColors.text.tertiary, 
            fontSize: 10, 
            textAlign: 'center',
            marginBottom: 4,
          }}>
            {formatDate(item.created_at)}
          </Text>
          
          {item.note && (
            <Text 
              style={{ 
                color: bvColors.text.muted, 
                fontSize: 11, 
                textAlign: 'center',
                lineHeight: 14,
              }}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          )}
        </View>
        
        {/* Note Encouragement */}
        <NoteEncouragement
          mediaId={item.id}
          hasNote={!!item.note}
          mediaType={item.type}
          onAddNotePress={() => handleAddNote(item)}
        />
        </TouchableOpacity>
      </GlassCard>
    );
  };

  const MediaCard = ({ item }: { item: MediaItem }) => {
    const isSelected = selectedItems.has(item.id);
    const videoThumbnail = isImageThumbnailUri(item.thumb_uri) ? item.thumb_uri : null;
    
    const handlePress = () => {
      if (isSelectionMode) {
        toggleItemSelection(item.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        if (item.type === 'photo') {
          // For photos, find the index and navigate to gallery
          const photoIndex = media.filter(m => m.type === 'photo').findIndex(m => m.id === item.id);
          const folderQueryParam = `&folderId=${encodeURIComponent(currentFolder ?? '')}`;
          router.push(`/project/${id}/gallery?initialIndex=${photoIndex}${folderQueryParam}`);
        } else {
          // For videos and documents, navigate to media detail
          router.push(`/project/${id}/media/${item.id}`);
        }
      }
    };

    return (
      <GlassCard
        style={{
          marginBottom: 12,
          backgroundColor: isSelected ? bvFx.selectionSoft : undefined,
          borderWidth: isSelected ? 1 : 0,
          borderColor: isSelected ? bvColors.interactive.selected : 'transparent',
        }}
        intensity={60}
        shadowEnabled={true}
      >
        <TouchableOpacity
          style={{
            padding: 16,
          }}
          onPress={handlePress}
          onLongPress={() => {
            if (!isSelectionMode) {
              Alert.alert(
                'Media Options',
                'What would you like to do with this media?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Move to Folder',
                    onPress: () => handleMoveMedia(item),
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteMedia(item),
                  },
                ]
              );
            }
          }}
          activeOpacity={0.7}
        >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {isSelectionMode && (
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: isSelected ? bvColors.interactive.selected : bvColors.text.tertiary,
            backgroundColor: isSelected ? bvColors.interactive.selected : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color={bvColors.neutral[0]} />
            )}
          </View>
        )}
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: bvColors.brand.accent,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {item.type === 'photo' ? (
            <ExpoImage
              source={{ uri: item.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
            />
          ) : item.type === 'video' && videoThumbnail ? (
            <>
              <Image
                source={{ uri: videoThumbnail }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: bvFx.blackTint25,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <View style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: bvFx.appOverlay,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="play" size={14} color={bvColors.neutral[0]} />
                </View>
              </View>
            </>
          ) : (
            <Ionicons
              name={
                item.type === 'video' ? 'videocam' : 'document'
              }
              size={22}
              color={bvColors.surface.inverse}
            />
          )}
          {item.type === 'photo' && (
            <View style={{
              position: 'absolute',
              top: -2,
              right: -2,
              backgroundColor: bvColors.brand.accent,
              borderRadius: 8,
              width: 16,
              height: 16,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: bvColors.surface.inverse,
            }}>
              <Ionicons name="albums" size={8} color={bvColors.surface.inverse} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '600' }}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </Text>
          <Text style={{ color: bvColors.text.tertiary, fontSize: 12, marginTop: 2 }}>
            {formatDate(item.created_at)}
          </Text>
          {item.note && (
            <Text style={{ color: bvColors.text.muted, fontSize: 14, marginTop: 4 }}>
              {item.note}
            </Text>
          )}
          {item.type === 'video' && item.uri.includes('placeholder') && (
            <Text style={{ color: bvColors.text.tertiary, fontSize: 12, marginTop: 2 }}>
              🎬 3s • MP4 • ~2MB • Simulation
            </Text>
          )}
          {item.type === 'video' && !item.uri.includes('placeholder') && (
            <Text style={{ color: bvColors.text.tertiary, fontSize: 12, marginTop: 2 }}>
              🎬 Recorded • MP4 • Ready to play
            </Text>
          )}
          {item.type === 'photo' && (
            <Text style={{ color: bvColors.text.tertiary, fontSize: 12, marginTop: 2 }}>
              📸 Tap to view in gallery • Swipe to browse
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={bvColors.text.tertiary} />
      </View>
      
      {/* Note Encouragement */}
      <NoteEncouragement
        mediaId={item.id}
        hasNote={!!item.note}
        mediaType={item.type}
        onAddNotePress={() => handleAddNote(item)}
      />
        </TouchableOpacity>
      </GlassCard>
    );
  };

  const mediaSummary = React.useMemo(() => {
    const summary = {
      photos: 0,
      videos: 0,
      docs: 0,
      notes: 0,
    };

    for (const item of projectMedia) {
      if (item.type === 'photo') summary.photos += 1;
      if (item.type === 'video') summary.videos += 1;
      if (item.type === 'doc') summary.docs += 1;
      if (item.note && item.note.trim().length > 0) summary.notes += 1;
    }

    return summary;
  }, [projectMedia]);

  const quickActions: Array<{
    id: string;
    icon: IoniconName;
    label: string;
    onPress: () => void;
    enabled: boolean;
  }> = [
    { id: 'capture', icon: 'camera-outline', label: 'Capture', onPress: handleCaptureMedia, enabled: true },
    { id: 'upload', icon: 'cloud-upload-outline', label: 'Upload', onPress: handleDocumentUpload, enabled: true },
    { id: 'public', icon: 'globe-outline', label: 'Public', onPress: handleOpenPublicSettings, enabled: true },
    { id: 'activity', icon: 'add-circle-outline', label: 'Activity', onPress: handleOpenActivityModal, enabled: true },
  ];

  const recentActivityFeed = React.useMemo(() => {
    const projectMediaIds = new Set(projectMedia.map((item) => item.id));
    const projectPreviewUris = projectMedia
      .filter((item) => item.type === 'photo' || item.type === 'video')
      .slice(0, 3)
      .map((item) => (item.type === 'video' ? item.thumb_uri || item.uri : item.uri))
      .filter((uri): uri is string => !!uri);

    return recentActivity.slice(0, 8).map((entry, index) => {
      const presentation = mapActivityPresentation(entry);
      const canExpand = presentation.expandable && projectPreviewUris.length > 0 && index === 0;
      const canManage = isManualActivityType(entry.action_type);
      const referenceId = resolveActivityReferenceId(entry);
      const linkedMediaId = referenceId && projectMediaIds.has(referenceId) ? referenceId : null;
      const actorName = typeof entry.actor_name_snapshot === 'string' && entry.actor_name_snapshot.trim().length > 0
        ? entry.actor_name_snapshot.trim()
        : null;
      return {
        id: entry.id,
        actionType: entry.action_type,
        metadataRaw: entry.metadata ?? null,
        referenceId,
        linkedMediaId,
        canManage,
        timestampLabel: formatRelativeTime(entry.created_at),
        actorName,
        previewUris: canExpand ? projectPreviewUris : [],
        expanded: canExpand,
        ...presentation,
      };
    });
  }, [recentActivity, projectMedia]);

  const activityAttachmentOptions = React.useMemo(() => {
    return projectMedia.slice(0, 24);
  }, [projectMedia]);

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: bvColors.text.muted }}>Loading project...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bvColors.surface.inverse }}>
      {/* Header (animated opacity, overlay) */}
      <Reanimated.View 
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 12, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: bvColors.surface.inverse, pointerEvents: 'box-none' }, headerAnimatedStyle]}
      >
        <View style={{ pointerEvents: 'auto' }}>
        {/* Top action bar: left and right clusters, no absolute positioning */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isSelectionMode ? (
              <>
                <TouchableOpacity
                  onPress={toggleSelectionMode}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: bvColors.surface.chrome,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Ionicons name="close" size={20} color={bvColors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={selectedItems.size === media.length ? clearSelection : selectAllItems}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: bvColors.surface.chrome,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons 
                    name={selectedItems.size === media.length ? 'square-outline' : 'checkbox'}
                    size={20}
                    color={bvColors.text.primary}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: bvColors.surface.chrome,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color={bvColors.text.primary} />
                </TouchableOpacity>
                {media.length > 0 && (
                  <>
                    <TouchableOpacity
                      onPress={toggleViewMode}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: bvColors.surface.chrome,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                      }}
                    >
                      <Ionicons 
                        name={viewMode === 'list' ? 'grid' : 'list'}
                        size={20}
                        color={bvColors.text.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={toggleSelectionMode}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: bvColors.surface.chrome,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="checkbox-outline" size={20} color={bvColors.text.primary} />
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isSelectionMode ? (
              <>
                <TouchableOpacity
                  onPress={handleShareSelected}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: selectedItems.size > 0 ? bvColors.interactive.selected : bvColors.surface.muted,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                  disabled={selectedItems.size === 0}
                >
                  <Ionicons 
                    name="share"
                    size={20}
                    color={selectedItems.size > 0 ? bvColors.neutral[0] : bvColors.text.tertiary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteSelected}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: selectedItems.size > 0 ? bvColors.semantic.dangerStrong : bvColors.surface.muted,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  disabled={selectedItems.size === 0}
                >
                  <Ionicons 
                    name="trash"
                    size={20}
                    color={selectedItems.size > 0 ? bvColors.neutral[0] : bvColors.text.tertiary}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ position: 'relative', marginRight: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowMediaFilterSheet(true)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: mediaActiveFilterCount > 0 ? bvFx.accentSoft : bvColors.surface.chrome,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: mediaActiveFilterCount > 0 ? bvFx.accentBorder : bvFx.neutralBorder
                    }}
                  >
                    <Ionicons name="filter" size={20} color={mediaActiveFilterCount > 0 ? bvColors.brand.accent : bvColors.text.primary} />
                  </TouchableOpacity>
                  {mediaActiveFilterCount > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: bvColors.brand.accent,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: bvFx.blackTint20
                    }}>
                      <Text style={{ color: bvColors.surface.inverse, fontSize: 11, fontWeight: '700' }}>{mediaActiveFilterCount}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleShareProject}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: bvColors.surface.chrome,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="share" size={20} color={bvColors.text.primary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Title and description */}
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: bvColors.text.primary, fontSize: 24, fontWeight: 'bold' }}>
            {isSelectionMode ? `${selectedItems.size} Selected` : project.name}
          </Text>
          {!isSelectionMode && currentFolder && (
            <Text style={{ color: bvColors.brand.accent, fontSize: 16, marginTop: 2 }}>
              📁 {folders.find(f => f.id === currentFolder)?.name || 'Folder'}
            </Text>
          )}
          <Text style={{ color: bvColors.text.muted, fontSize: 14, marginTop: 4 }}>
            {isSelectionMode 
              ? 'Tap items to select • Use buttons to share or delete' 
              : `Project Details • ${viewMode === 'list' ? 'List' : 'Grid'} View`}
          </Text>
        </View>
          {/* Folder Management inside header */}
          {!isSelectionMode && (
            <View style={{ marginTop: 12 }}>
              {/* Folder Selector */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  paddingRight: 16 
                }}
                style={{ marginBottom: 12 }}
                pointerEvents="auto"
              >
                <GlassCard
                  style={{
                    marginRight: 8,
                    backgroundColor: currentFolder === null ? bvFx.accentSoft : undefined,
                    borderWidth: currentFolder === null ? 1 : 0,
                    borderColor: currentFolder === null ? bvColors.brand.accent : 'transparent',
                  }}
                  intensity={60}
                  shadowEnabled={true}
                >
                  <TouchableOpacity
                    onPress={() => handleSelectFolder(null)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="home" size={16} color={currentFolder === null ? bvColors.brand.accent : bvColors.text.primary} />
                    <Text style={{ 
                      color: currentFolder === null ? bvColors.brand.accent : bvColors.text.primary, 
                      fontSize: 12, 
                      fontWeight: '600',
                      marginLeft: 4 
                    }}>
                      All Media
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
                {folders.map(folder => (
                  <GlassCard
                    key={folder.id}
                    style={{
                      marginRight: 8,
                      backgroundColor: currentFolder === folder.id ? bvFx.accentSoft : undefined,
                      borderWidth: currentFolder === folder.id ? 1 : 0,
                      borderColor: currentFolder === folder.id ? bvColors.brand.accent : 'transparent',
                    }}
                    intensity={60}
                    shadowEnabled={true}
                  >
                    <TouchableOpacity
                      onPress={() => handleSelectFolder(folder.id)}
                      onLongPress={() => openFolderOptions(folder)}
                      delayLongPress={200}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="folder" size={16} color={currentFolder === folder.id ? bvColors.brand.accent : bvColors.text.primary} />
                      <Text style={{ 
                        color: currentFolder === folder.id ? bvColors.brand.accent : bvColors.text.primary, 
                        fontSize: 12, 
                        fontWeight: '600',
                        marginLeft: 4 
                      }}>
                        {folder.name}
                      </Text>
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={14}
                        color={currentFolder === folder.id ? bvColors.brand.accent : bvColors.text.muted}
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  </GlassCard>
                ))}
                <GlassCard
                  style={{
                    borderWidth: 1,
                    borderColor: bvColors.brand.accent,
                    backgroundColor: bvFx.accentTint,
                  }}
                  intensity={60}
                  shadowEnabled={true}
                >
                  <TouchableOpacity
                    onPress={openCreateFolderModal}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="add" size={16} color={bvColors.brand.accent} />
                    <Text style={{ color: bvColors.brand.accent, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                      New Folder
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
              </ScrollView>
              {/* Current Folder Indicator */}
              <GlassCard
                style={{
                  backgroundColor: bvFx.accentHint,
                  borderWidth: 1,
                  borderColor: bvFx.accentSoft,
                }}
                intensity={40}
                shadowEnabled={false}
              >
                <View style={{
                  paddingHorizontal: 12, 
                  paddingVertical: 8, 
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="camera" size={14} color={bvColors.brand.accent} />
                  <Text style={{ color: bvColors.text.muted, fontSize: 12, marginLeft: 6 }}>
                    New media will be saved to: <Text style={{ color: bvColors.brand.accent, fontWeight: '600' }}>
                      {currentFolder ? folders.find(f => f.id === currentFolder)?.name : 'All Media'}
                    </Text>
                  </Text>
                </View>
              </GlassCard>
            </View>
          )}
        </View>
      </Reanimated.View>

      {/* Media List/Grid */}

      <AnimatedFlatList
        data={visibleMedia}
        keyExtractor={(item) => (item as MediaItem).id}
        contentContainerStyle={{ 
          paddingHorizontal: 16, 
          paddingTop: topOverlayHeight,
          paddingBottom: 100,
        }}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between' } : undefined}
        key={viewMode} // Force re-render when view mode changes
        ListHeaderComponent={() =>
          isSelectionMode ? null : (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: bvColors.text.primary, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
                Quick Actions
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                {quickActions.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    onPress={action.onPress}
                    disabled={!action.enabled}
                    style={{ width: '23.5%', opacity: action.enabled ? 1 : 0.45 }}
                    activeOpacity={0.88}
                  >
                    <BVCard style={{ width: '100%' }} contentStyle={{ paddingVertical: 14, alignItems: 'center' }}>
                      <Ionicons
                        name={action.icon}
                        size={22}
                        color={action.enabled ? bvColors.brand.primaryLight : bvColors.text.tertiary}
                      />
                      <Text style={{ color: bvColors.text.primary, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
                        {action.label}
                      </Text>
                    </BVCard>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: bvColors.text.primary, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
                Project Summary
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  { id: 'photos', label: 'Photos', value: mediaSummary.photos },
                  { id: 'videos', label: 'Videos', value: mediaSummary.videos },
                  { id: 'docs', label: 'Docs', value: mediaSummary.docs },
                  { id: 'folders', label: 'Folders', value: folders.length },
                ].map((stat) => (
                  <BVCard key={stat.id} style={{ width: '48%', marginBottom: 12 }} contentStyle={{ padding: 14 }}>
                    <Text style={{ color: bvColors.text.primary, fontSize: 28, fontWeight: '700' }}>{stat.value}</Text>
                    <Text style={{ color: bvColors.text.muted, fontSize: 13, marginTop: 2 }}>{stat.label}</Text>
                  </BVCard>
                ))}
              </View>

              <Text style={{ color: bvColors.text.primary, fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 12 }}>
                Recent Activity
              </Text>

              {recentActivityFeed.length === 0 ? (
                <BVCard style={{ marginBottom: 12 }} contentStyle={{ padding: 16 }}>
                  <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '600' }}>
                    No activity yet
                  </Text>
                  <Text style={{ color: bvColors.text.muted, fontSize: 13, marginTop: 4 }}>
                    Capture media or add notes to build your project timeline.
                  </Text>
                </BVCard>
              ) : (
                <View style={{ position: 'relative', paddingBottom: 6 }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: 24,
                      top: 42,
                      bottom: 14,
                      width: 2,
                      backgroundColor: 'rgba(148,163,184,0.28)',
                    }}
                  />

                  {recentActivityFeed.map((entry) => (
                    <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
                      <View
                        style={{
                          width: 48,
                          alignItems: 'center',
                          marginRight: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: entry.iconBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name={entry.icon} size={20} color={entry.iconColor} />
                        </View>
                      </View>

                      <View style={{ flex: 1 }}>
                        <BVCard
                          style={{ width: '100%' }}
                          contentStyle={{ padding: 14 }}
                          onPress={
                            entry.linkedMediaId
                              ? () => openLinkedMediaFromActivity(entry.linkedMediaId as string)
                              : entry.canManage
                                ? () => handleActivityCardPress(entry)
                                : undefined
                          }
                          onLongPress={entry.canManage ? () => handleActivityCardPress(entry) : undefined}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: bvColors.text.primary, fontSize: 18, fontWeight: '700', lineHeight: 24 }}>
                                {entry.title}
                              </Text>
                              <Text style={{ color: bvColors.text.muted, fontSize: 12, marginTop: 2 }}>
                                {entry.actorName ? `${entry.timestampLabel} • by ${entry.actorName}` : entry.timestampLabel}
                              </Text>
                            </View>
                            {entry.linkedMediaId ? (
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: bvFx.neutralBorderSoft,
                                  backgroundColor: bvColors.surface.chrome,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="chevron-forward" size={18} color={bvColors.text.secondary} />
                              </View>
                            ) : entry.expanded ? (
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: bvFx.neutralBorderSoft,
                                  backgroundColor: bvColors.surface.chrome,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="chevron-up" size={18} color={bvColors.text.secondary} />
                              </View>
                            ) : entry.canManage ? (
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: bvFx.neutralBorderSoft,
                                  backgroundColor: bvColors.surface.chrome,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="ellipsis-horizontal" size={18} color={bvColors.text.secondary} />
                              </View>
                            ) : null}
                          </View>

                          <Text style={{ color: bvColors.text.secondary, fontSize: 15, marginTop: 8, lineHeight: 20 }}>
                            {entry.description}
                          </Text>

                          {entry.linkedMediaId ? (
                            <Text style={{ color: bvColors.brand.primaryLight, fontSize: 12, marginTop: 8, fontWeight: '600' }}>
                              Tap to open linked media
                            </Text>
                          ) : null}

                          {entry.previewUris.length > 0 && (
                            <View
                              style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: bvFx.neutralBorder,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                              }}
                            >
                              {entry.previewUris.map((uri, previewIndex) => (
                                <ExpoImage
                                  key={`${entry.id}-${previewIndex}`}
                                  source={{ uri }}
                                  style={{
                                    width: '31%',
                                    aspectRatio: 1.55,
                                    borderRadius: 12,
                                    backgroundColor: bvColors.surface.muted,
                                  }}
                                  contentFit="cover"
                                  transition={200}
                                />
                              ))}
                            </View>
                          )}
                        </BVCard>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <BVCard style={{ marginTop: 8 }} contentStyle={{ padding: 14 }}>
                <Text style={{ color: bvColors.text.primary, fontSize: 16, fontWeight: '700' }}>
                  Media Library
                </Text>
                <Text style={{ color: bvColors.text.muted, fontSize: 13, marginTop: 4 }}>
                  {shouldCondenseMedia && !showAllMedia
                    ? `Showing latest ${mediaPreviewLimit} of ${filteredMedia.length} items.`
                    : `Showing ${visibleMedia.length} item${visibleMedia.length === 1 ? '' : 's'}.`}
                </Text>
                {shouldCondenseMedia ? (
                  <TouchableOpacity
                    onPress={() => setShowAllMedia((prev) => !prev)}
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: bvColors.brand.primaryLight, fontSize: 13, fontWeight: '700' }}>
                      {showAllMedia ? 'Show Latest Only' : 'View All Media'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </BVCard>
            </View>
          )
        }
        renderItem={({ item }) => {
          const mediaItem = item as MediaItem;
          return viewMode === 'grid' ? <MediaCardGrid item={mediaItem} /> : <MediaCard item={mediaItem} />;
        }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListEmptyComponent={() => (
          <BVEmptyState
            title="No media yet"
            description="Capture photos, videos, or upload documents to get started."
            icon="images-outline"
            actionLabel="Capture Media"
            onAction={handleCaptureMedia}
            style={{ marginTop: 60 }}
          />
        )}
      />

      {/* Add Media Button */}
      <BVFloatingAction
        icon="camera"
        size={60}
        onPress={handleCaptureMedia}
        right={20}
        bottom={FAB_BOTTOM_OFFSET}
      />

  {/* Folder Creation Modal */}
      {showFolderModal && (
        <GlassModal visible={showFolderModal} onRequestClose={closeFolderModal}>
          <View style={{ padding: 24 }}>
            <Text style={{ 
              color: bvColors.text.primary, 
              fontSize: 20, 
              fontWeight: '600', 
              marginBottom: 16,
              textAlign: 'center'
            }}>
              {folderModalMode === 'edit' ? 'Rename Folder' : 'Create New Folder'}
            </Text>
            
            <GlassTextInput
              containerStyle={{
                marginBottom: 20,
              }}
              label="Folder Name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={folderModalMode === 'edit' ? 'Update folder name...' : 'Enter folder name...'}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleFolderSubmit}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <GlassButton
                variant="secondary"
                size="large"
                title="Cancel"
                onPress={closeFolderModal}
                style={{ flex: 1 }}
              />
              <GlassButton
                variant="primary"
                size="large"
                title={folderModalMode === 'edit' ? 'Save' : 'Create'}
                onPress={handleFolderSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </GlassModal>
      )}

      {/* Manual Activity Modal */}
      <GlassModal visible={showActivityModal} onRequestClose={handleCloseActivityModal}>
        <ScrollView style={{ maxHeight: '88%' }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: bvColors.text.primary,
            textAlign: 'center',
            marginBottom: 8,
          }}>
            {activityModalMode === 'edit' ? 'Edit Activity' : 'Add Activity'}
          </Text>
          <Text style={{
            fontSize: 14,
            color: bvColors.text.muted,
            textAlign: 'center',
            marginBottom: 18,
          }}>
            {activityModalMode === 'edit'
              ? 'Update this timeline entry.'
              : 'Log internal process updates for this project.'}
          </Text>

          <Text style={{ fontSize: 15, fontWeight: '600', color: bvColors.text.primary, marginBottom: 10 }}>
            Activity Type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 }}>
            {MANUAL_ACTIVITY_OPTIONS.map((option) => {
              const isSelected = manualActivityType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setManualActivityType(option.value)}
                  activeOpacity={0.86}
                  style={{
                    width: '48%',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isSelected ? option.color : bvFx.neutralBorderSoft,
                    backgroundColor: isSelected ? `${option.color}20` : bvColors.surface.chrome,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={option.icon} size={16} color={isSelected ? option.color : bvColors.text.tertiary} />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 13,
                      fontWeight: '600',
                      color: isSelected ? option.color : bvColors.text.secondary,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <GlassTextInput
            label="Description"
            value={manualActivityDescription}
            onChangeText={setManualActivityDescription}
            placeholder={
              manualActivityType === 'material_purchase'
                ? 'e.g. Steel beams and concrete'
                : manualActivityType === 'safety_inspection'
                  ? 'e.g. All checks passed with no violations'
                  : manualActivityType === 'meeting_notes'
                    ? 'e.g. Weekly progress review with stakeholders'
                    : 'e.g. Follow-up site coordination visit'
            }
            multiline
            numberOfLines={4}
            inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
            returnKeyType="done"
          />

          {manualActivityType === 'material_purchase' && (
            <GlassTextInput
              label="Amount (Optional)"
              value={manualActivityAmount}
              onChangeText={setManualActivityAmount}
              placeholder="e.g. 45230"
              keyboardType="numeric"
              returnKeyType="done"
            />
          )}

          <Text style={{ fontSize: 15, fontWeight: '600', color: bvColors.text.primary, marginTop: 4, marginBottom: 8 }}>
            Link Media (Optional)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
            <TouchableOpacity
              onPress={() => setManualActivityReferenceId(null)}
              activeOpacity={0.86}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: manualActivityReferenceId === null ? bvColors.brand.primaryLight : bvFx.neutralBorderSoft,
                backgroundColor: manualActivityReferenceId === null ? bvFx.accentSoft : bvColors.surface.chrome,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 8,
              }}
            >
              <Text style={{
                color: manualActivityReferenceId === null ? bvColors.brand.primaryLight : bvColors.text.secondary,
                fontSize: 12,
                fontWeight: '700',
              }}>
                No Media
              </Text>
            </TouchableOpacity>
            {activityAttachmentOptions.map((item) => {
              const selected = manualActivityReferenceId === item.id;
              const iconName: IoniconName = item.type === 'photo' ? 'image-outline' : item.type === 'video' ? 'videocam-outline' : 'document-outline';
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setManualActivityReferenceId(item.id)}
                  activeOpacity={0.86}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? bvColors.brand.primaryLight : bvFx.neutralBorderSoft,
                    backgroundColor: selected ? bvFx.accentSoft : bvColors.surface.chrome,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginRight: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons
                    name={iconName}
                    size={14}
                    color={selected ? bvColors.brand.primaryLight : bvColors.text.tertiary}
                  />
                  <Text style={{
                    marginLeft: 6,
                    color: selected ? bvColors.brand.primaryLight : bvColors.text.secondary,
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                    {item.type.toUpperCase()} • {formatRelativeTime(item.created_at)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <GlassButton
              title="Cancel"
              onPress={handleCloseActivityModal}
              style={{ flex: 1 }}
              variant="secondary"
            />
            <GlassButton
              title={activityModalMode === 'edit' ? 'Update Activity' : 'Save Activity'}
              onPress={handleSaveActivity}
              style={{ flex: 1 }}
              variant="primary"
            />
          </View>
        </ScrollView>
      </GlassModal>

      {/* Note Editing Modal */}
      <GlassModal visible={showNoteModal} onRequestClose={handleCancelNote}>
        <View style={{ padding: 20 }}>
          <Text style={{ 
            fontSize: 20, 
            fontWeight: '600', 
            color: bvColors.text.primary, 
            marginBottom: 8,
            textAlign: 'center' 
          }}>
            {editingNoteItem?.note ? 'Edit Note' : 'Add Note'}
          </Text>
          
          <Text style={{ 
            fontSize: 14, 
            color: bvColors.text.muted, 
            marginBottom: 20,
            textAlign: 'center' 
          }}>
            {editingNoteItem?.type === 'photo' ? 'Photo' : 
             editingNoteItem?.type === 'video' ? 'Video' : 'Document'} • {
             editingNoteItem ? new Date(editingNoteItem.created_at).toLocaleDateString() : ''
            }
          </Text>

          <GlassTextInput
            placeholder="Enter your note here..."
            value={noteText}
            onChangeText={setNoteText}
            multiline
            numberOfLines={6}
            inputStyle={{
              minHeight: 120,
              textAlignVertical: 'top',
              marginBottom: 20,
            }}
          />

          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between',
            gap: 12
          }}>
            <GlassButton
              title="Cancel"
              onPress={handleCancelNote}
              style={{ flex: 1 }}
              variant="secondary"
            />
            <GlassButton
              title="Save Note"
              onPress={handleSaveNote}
              style={{ flex: 1 }}
              variant="primary"
            />
          </View>
        </View>
      </GlassModal>

      {/* Reusable Action Sheet for this screen */}
      <GlassActionSheet
        visible={actionSheet.visible}
        onClose={() => setActionSheet({ visible: false })}
        title={actionSheet.title}
        message={actionSheet.message}
        actions={actionSheet.actions || []}
      />

      {/* Media Filters & Sort */}
      <GlassActionSheet
        visible={showMediaFilterSheet}
        onClose={() => setShowMediaFilterSheet(false)}
        title="Media Filters & Sort"
        message={(preferDbFiltering || isLarge || currentFolder !== null) ? 'Using DB-backed filtering for performance' : undefined}
        actions={[
          { label: `${mediaFilters.types.photo ? '✓ ' : ''}Photos`, onPress: () => setMediaFilters(v => ({ ...v, types: { ...v.types, photo: !v.types.photo } })) },
          { label: `${mediaFilters.types.video ? '✓ ' : ''}Videos`, onPress: () => setMediaFilters(v => ({ ...v, types: { ...v.types, video: !v.types.video } })) },
          { label: `${mediaFilters.types.doc ? '✓ ' : ''}Documents`, onPress: () => setMediaFilters(v => ({ ...v, types: { ...v.types, doc: !v.types.doc } })) },
          { label: `${mediaFilters.hasNoteOnly ? '✓ ' : ''}Has notes only`, onPress: () => setMediaFilters(v => ({ ...v, hasNoteOnly: !v.hasNoteOnly })) },
          { label: `Sort: Newest first ${mediaFilters.sortBy==='date_desc' ? '✓' : ''}`, onPress: () => setMediaFilters(v => ({ ...v, sortBy: 'date_desc' })) },
          { label: `Sort: Oldest first ${mediaFilters.sortBy==='date_asc' ? '✓' : ''}`, onPress: () => setMediaFilters(v => ({ ...v, sortBy: 'date_asc' })) },
          { label: `Sort: Name A–Z ${mediaFilters.sortBy==='name_asc' ? '✓' : ''}`, onPress: () => setMediaFilters(v => ({ ...v, sortBy: 'name_asc' })) },
          { label: `Sort: Type A–Z ${mediaFilters.sortBy==='type_asc' ? '✓' : ''}`, onPress: () => setMediaFilters(v => ({ ...v, sortBy: 'type_asc' })) },
          { label: `${mediaFilters.dateFrom ? '✓ ' : ''}Date: Last 7 days`, onPress: () => setMediaFilters(v => ({ ...v, dateFrom: Date.now() - 7*24*60*60*1000, dateTo: null })) },
          { label: `${mediaFilters.dateFrom ? '✓ ' : ''}Date: Last 30 days`, onPress: () => setMediaFilters(v => ({ ...v, dateFrom: Date.now() - 30*24*60*60*1000, dateTo: null })) },
          { label: 'Date: Any', onPress: () => setMediaFilters(v => ({ ...v, dateFrom: null, dateTo: null })) },
          { label: 'Clear all filters', onPress: () => setMediaFilters({ types: { photo: true, video: true, doc: true }, hasNoteOnly: false, sortBy: 'date_desc', dateFrom: null, dateTo: null }) },
        ]}
      />
  </View>
  );
}

export default function ProjectDetail() {
  return (
    <ScrollProvider>
      <ProjectDetailContent />
    </ScrollProvider>
  );
}
