import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MediaItem, getMediaByProject, getProjectById, deleteMedia, Project, createMedia, Folder, getFoldersByProject, createFolder, deleteFolder, getMediaByFolder, moveMediaToFolder } from '../../../lib/db';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { saveMediaToProject, getMediaType } from '../../../lib/files';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LazyImage from '../../../components/LazyImage';
import { ImageVariants, getImageVariants, checkImageVariantsExist, generateImageVariants, cleanupImageVariants } from '../../../lib/imageOptimization';
import NoteEncouragement from '../../../components/NoteEncouragement';
import { GlassCard, GlassFAB, GlassTextInput, GlassButton } from '../../../components/glass';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Animation values for dynamic header (match Projects/Settings pattern)
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const topOverlayHeight = headerHeight > 0 ? headerHeight : insets.top + 160;

  const handleScroll = (event: any) => {
    try {
      const offsetY = event.nativeEvent.contentOffset.y;
      const fadeStart = 50;
      const fadeEnd = 150;
      if (offsetY > fadeStart) {
        const progress = Math.min((offsetY - fadeStart) / (fadeEnd - fadeStart), 1);
        const opacity = Math.max(0, 1 - progress);
        headerOpacity.setValue(opacity);
      } else {
        headerOpacity.setValue(1);
      }
    } catch (e) {
      headerOpacity.setValue(1);
    }
  };

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

  const loadData = useCallback(() => {
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
      const mediaItems = getMediaByFolder(id, currentFolder);
      setMedia(mediaItems);
      
      // Check for videos that need thumbnail regeneration
      const videosNeedingThumbnails = mediaItems.filter(item => 
        item.type === 'video' && 
        item.thumb_uri && 
        !item.thumb_uri.endsWith('.jpg')
      );
      
      if (videosNeedingThumbnails.length > 0) {
        console.log(`Found ${videosNeedingThumbnails.length} videos needing thumbnail regeneration`);
        // Regenerate thumbnails in the background
        videosNeedingThumbnails.forEach(async (video) => {
          try {
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
            
            await FileSystem.moveAsync({
              from: thumbnailResult.uri,
              to: thumbFileUri,
            });
            
            console.log(`Regenerated thumbnail for video ${video.id}: ${thumbFileUri}`);
          } catch (error) {
            console.error(`Failed to regenerate thumbnail for video ${video.id}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      Alert.alert('Error', 'Failed to load project data');
    }
  }, [id, router, currentFolder]);

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
      const mediaItem = createMedia({
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
        version: '1.0.1',
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
        version: '1.0.1',
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
        // Create a list of all files to share
        const filesToShare = [projectInfoPath, ...copiedFiles];
        
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

  const handleDeleteMedia = (mediaItem: MediaItem) => {
    const mediaTypeName = mediaItem.type === 'photo' ? 'photo' : 
                         mediaItem.type === 'video' ? 'video' : 'document';
    
    Alert.alert(
      'Delete Media',
      `Are you sure you want to delete this ${mediaTypeName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
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
              
              // Clean up image variants if it's a photo
              if (mediaItem.type === 'photo' && id) {
                await cleanupImageVariants(mediaItem.id, id);
              }
              
              // Delete from database
              deleteMedia(mediaItem.id);
              
              // Provide haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              // Refresh the media list
              loadData();
              
              Alert.alert('Success', `${mediaTypeName.charAt(0).toUpperCase() + mediaTypeName.slice(1)} deleted successfully!`);
              
            } catch (error) {
              console.error('Error deleting media:', error);
              Alert.alert('Error', 'Failed to delete media. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
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
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      const folder = createFolder({
        project_id: id!,
        name: newFolderName.trim(),
      });
      
      setFolders(prev => [...prev, folder]);
      setNewFolderName('');
      setShowFolderModal(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Success', 'Folder created successfully!');
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folderName}"? All media in this folder will be moved to the root level.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteFolder(folderId);
              setFolders(prev => prev.filter(f => f.id !== folderId));
              
              // If we're currently viewing this folder, go back to root
              if (currentFolder === folderId) {
                setCurrentFolder(null);
              }
              
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Success', 'Folder deleted successfully!');
            } catch (error) {
              console.error('Error deleting folder:', error);
              Alert.alert('Error', 'Failed to delete folder');
            }
          },
        },
      ]
    );
  };

  const handleSelectFolder = (folderId: string | null) => {
    setCurrentFolder(folderId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMoveMedia = (mediaItem: MediaItem) => {
    const currentFolderName = currentFolder ? folders.find(f => f.id === currentFolder)?.name : 'All Media';
    
    Alert.alert(
      'Move Media',
      `Move "${mediaItem.type}" to which folder?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'All Media',
          onPress: () => {
            try {
              moveMediaToFolder(mediaItem.id, null);
              loadData();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Success', 'Media moved to All Media');
            } catch (error) {
              console.error('Error moving media:', error);
              Alert.alert('Error', 'Failed to move media');
            }
          },
        },
        ...folders.map(folder => ({
          text: folder.name,
          onPress: () => {
            try {
              moveMediaToFolder(mediaItem.id, folder.id);
              loadData();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Success', `Media moved to ${folder.name}`);
            } catch (error) {
              console.error('Error moving media:', error);
              Alert.alert('Error', 'Failed to move media');
            }
          },
        })),
      ]
    );
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

  const MediaCardGrid = ({ item }: { item: MediaItem }) => {
    const isSelected = selectedItems.has(item.id);
    const [variants, setVariants] = useState<ImageVariants | null>(null);
    const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
    
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
    }, [item.id, item.uri, item.type, id]);
    
    const handlePress = () => {
      if (isSelectionMode) {
        toggleItemSelection(item.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        if (item.type === 'photo') {
          // For photos, find the index and navigate to gallery
          const photoIndex = media.filter(m => m.type === 'photo').findIndex(m => m.id === item.id);
          router.push(`/project/${id}/gallery?initialIndex=${photoIndex}`);
        } else {
          // For videos and documents, navigate to media detail
          router.push(`/project/${id}/media/${item.id}`);
        }
      }
    };

    return (
      <TouchableOpacity
        style={{
          backgroundColor: isSelected ? '#1E3A8A' : '#101826',
          borderRadius: 12,
          padding: 8,
          marginBottom: 8,
          borderWidth: 2,
          borderColor: isSelected ? '#3B82F6' : '#1F2A37',
          width: '48%', // Two columns with gap
          aspectRatio: 1, // Square aspect ratio
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
              borderColor: isSelected ? '#3B82F6' : '#64748B',
              backgroundColor: isSelected ? '#3B82F6' : 'transparent',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2,
            }}>
              {isSelected && (
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              )}
            </View>
          )}
          
          {/* Media Preview */}
          <View style={{
            flex: 1,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#1F2A37',
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
                  progressiveLoading={true}
                  priority="normal"
                />
              ) : (
                <Image
                  source={{ uri: item.uri }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
              )
            ) : item.type === 'video' ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {(() => {
                  console.log('Rendering video item:', {
                    id: item.id,
                    type: item.type,
                    thumb_uri: item.thumb_uri,
                    uri: item.uri,
                    hasThumbnail: !!item.thumb_uri
                  });
                  return null;
                })()}
                {item.thumb_uri && item.thumb_uri.endsWith('.jpg') ? (
                  <Image
                    source={{ uri: item.thumb_uri }}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    resizeMode="cover"
                    onError={(error) => {
                      console.log('Video thumbnail load error in MediaCardGrid:', error);
                      console.log('Failed URI:', item.thumb_uri);
                    }}
                    onLoad={() => {
                      console.log('Video thumbnail loaded successfully in MediaCardGrid:', item.thumb_uri);
                    }}
                  />
                ) : (
                  <Ionicons name="videocam" size={32} color="#FF7A1A" />
                )}
                <View style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}>
                  <Ionicons name="play" size={12} color="#FFFFFF" />
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="document" size={32} color="#FF7A1A" />
              </View>
            )}
          </View>
          
          {/* Type Badge */}
          <View style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
              color="#FFFFFF"
            />
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
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
              backgroundColor: 'rgba(255, 122, 26, 0.9)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#0B0F14',
              }} />
            </View>
          )}
          
          <Text style={{ 
            color: '#F8FAFC', 
            fontSize: 14, 
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: 4,
          }}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </Text>
          
          <Text style={{ 
            color: '#64748B', 
            fontSize: 10, 
            textAlign: 'center',
            marginBottom: 4,
          }}>
            {formatDate(item.created_at)}
          </Text>
          
          {item.note && (
            <Text 
              style={{ 
                color: '#94A3B8', 
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
          onAddNotePress={handlePress}
        />
      </TouchableOpacity>
    );
  };

  const MediaCard = ({ item }: { item: MediaItem }) => {
    const isSelected = selectedItems.has(item.id);
    
    const handlePress = () => {
      if (isSelectionMode) {
        toggleItemSelection(item.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        if (item.type === 'photo') {
          // For photos, find the index and navigate to gallery
          const photoIndex = media.filter(m => m.type === 'photo').findIndex(m => m.id === item.id);
          router.push(`/project/${id}/gallery?initialIndex=${photoIndex}`);
        } else {
          // For videos and documents, navigate to media detail
          router.push(`/project/${id}/media/${item.id}`);
        }
      }
    };

    return (
    <TouchableOpacity
      style={{
          backgroundColor: isSelected ? '#1E3A8A' : '#101826',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
          borderWidth: 2,
          borderColor: isSelected ? '#3B82F6' : '#1F2A37',
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
            borderColor: isSelected ? '#3B82F6' : '#64748B',
            backgroundColor: isSelected ? '#3B82F6' : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
        )}
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: '#FF7A1A',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
          position: 'relative',
        }}>
          <Ionicons
            name={
              item.type === 'photo' ? 'image' :
              item.type === 'video' ? 'videocam' : 'document'
            }
            size={20}
            color="#0B0F14"
          />
          {item.type === 'photo' && (
            <View style={{
              position: 'absolute',
              top: -2,
              right: -2,
              backgroundColor: '#FF7A1A',
              borderRadius: 8,
              width: 16,
              height: 16,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#0B0F14',
            }}>
              <Ionicons name="albums" size={8} color="#0B0F14" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </Text>
          <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
            {formatDate(item.created_at)}
          </Text>
          {item.note && (
            <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
              {item.note}
            </Text>
          )}
          {item.type === 'video' && item.uri.includes('placeholder') && (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              🎬 3s • MP4 • ~2MB • Simulation
            </Text>
          )}
          {item.type === 'video' && !item.uri.includes('placeholder') && (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              🎬 Recorded • MP4 • Ready to play
            </Text>
          )}
          {item.type === 'photo' && (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              📸 Tap to view in gallery • Swipe to browse
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      </View>
      
      {/* Note Encouragement */}
      <NoteEncouragement
        mediaId={item.id}
        hasNote={!!item.note}
        mediaType={item.type}
        onAddNotePress={handlePress}
      />
    </TouchableOpacity>
  );
  };

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#94A3B8' }}>Loading project...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      {/* Header (animated opacity, overlay) */}
      <Animated.View 
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 12, opacity: headerOpacity, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: '#0B0F14', pointerEvents: 'box-none' }}
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
                    backgroundColor: '#101826',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Ionicons name="close" size={20} color="#F8FAFC" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={selectedItems.size === media.length ? clearSelection : selectAllItems}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#101826',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons 
                    name={selectedItems.size === media.length ? 'square-outline' : 'checkbox'}
                    size={20}
                    color="#F8FAFC"
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
                    backgroundColor: '#101826',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
                </TouchableOpacity>
                {media.length > 0 && (
                  <>
                    <TouchableOpacity
                      onPress={toggleViewMode}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#101826',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                      }}
                    >
                      <Ionicons 
                        name={viewMode === 'list' ? 'grid' : 'list'}
                        size={20}
                        color="#F8FAFC"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={toggleSelectionMode}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#101826',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="checkbox-outline" size={20} color="#F8FAFC" />
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
                    backgroundColor: selectedItems.size > 0 ? '#3B82F6' : '#1F2A37',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                  disabled={selectedItems.size === 0}
                >
                  <Ionicons 
                    name="share"
                    size={20}
                    color={selectedItems.size > 0 ? '#FFFFFF' : '#64748B'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteSelected}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: selectedItems.size > 0 ? '#EF4444' : '#1F2A37',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  disabled={selectedItems.size === 0}
                >
                  <Ionicons 
                    name="trash"
                    size={20}
                    color={selectedItems.size > 0 ? '#FFFFFF' : '#64748B'}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={handleShareProject}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#101826',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="share" size={20} color="#F8FAFC" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Title and description */}
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 'bold' }}>
            {isSelectionMode ? `${selectedItems.size} Selected` : project.name}
          </Text>
          {!isSelectionMode && currentFolder && (
            <Text style={{ color: '#FF7A1A', fontSize: 16, marginTop: 2 }}>
              📁 {folders.find(f => f.id === currentFolder)?.name || 'Folder'}
            </Text>
          )}
          <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
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
                <TouchableOpacity
                  onPress={() => handleSelectFolder(null)}
                  style={{
                    backgroundColor: currentFolder === null ? '#FF7A1A' : '#1F2A37',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="home" size={16} color={currentFolder === null ? '#0B0F14' : '#F8FAFC'} />
                  <Text style={{ 
                    color: currentFolder === null ? '#0B0F14' : '#F8FAFC', 
                    fontSize: 12, 
                    fontWeight: '600',
                    marginLeft: 4 
                  }}>
                    All Media
                  </Text>
                </TouchableOpacity>
                {folders.map(folder => (
                  <TouchableOpacity
                    key={folder.id}
                    onPress={() => handleSelectFolder(folder.id)}
                    style={{
                      backgroundColor: currentFolder === folder.id ? '#FF7A1A' : '#1F2A37',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      marginRight: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="folder" size={16} color={currentFolder === folder.id ? '#0B0F14' : '#F8FAFC'} />
                    <Text style={{ 
                      color: currentFolder === folder.id ? '#0B0F14' : '#F8FAFC', 
                      fontSize: 12, 
                      fontWeight: '600',
                      marginLeft: 4 
                    }}>
                      {folder.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setShowFolderModal(true)}
                  style={{
                    backgroundColor: '#1F2A37',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#FF7A1A',
                    borderStyle: 'dashed',
                  }}
                >
                  <Ionicons name="add" size={16} color="#FF7A1A" />
                  <Text style={{ color: '#FF7A1A', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                    New Folder
                  </Text>
                </TouchableOpacity>
              </ScrollView>
              {/* Current Folder Indicator */}
              <View style={{ 
                backgroundColor: '#1F2A37', 
                paddingHorizontal: 12, 
                paddingVertical: 8, 
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="camera" size={14} color="#FF7A1A" />
                <Text style={{ color: '#94A3B8', fontSize: 12, marginLeft: 6 }}>
                  New media will be saved to: <Text style={{ color: '#FF7A1A', fontWeight: '600' }}>
                    {currentFolder ? folders.find(f => f.id === currentFolder)?.name : 'All Media'}
                  </Text>
                </Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Media List/Grid */}

      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingHorizontal: 16, 
          paddingTop: topOverlayHeight,
          paddingBottom: 100,
        }}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Force re-render when view mode changes
        renderItem={({ item }) => 
          viewMode === 'grid' ? <MediaCardGrid item={item} /> : <MediaCard item={item} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="images" size={64} color="#1F2A37" style={{ marginBottom: 20 }} />
            <Text style={{ color: '#94A3B8', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
              No media yet
            </Text>
            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center' }}>
              Capture photos, videos, or upload documents to get started
            </Text>
          </View>
        )}
      />

      {/* Add Media Button */}
      <GlassFAB
        icon="camera"
        size={60}
        onPress={handleCaptureMedia}
        style={{ position: 'absolute', right: 20, bottom: insets.bottom + 30 }}
      />

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <View style={{
            backgroundColor: '#101826',
            borderRadius: 16,
            padding: 24,
            width: '90%',
            maxWidth: 400,
            borderWidth: 1,
            borderColor: '#1F2A37',
          }}>
            <Text style={{ 
              color: '#F8FAFC', 
              fontSize: 20, 
              fontWeight: '600', 
              marginBottom: 16,
              textAlign: 'center'
            }}>
              Create New Folder
            </Text>
            
            <GlassTextInput
              style={{
                marginBottom: 20,
              }}
              label="Folder Name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Enter folder name..."
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <GlassButton
                variant="secondary"
                size="large"
                title="Cancel"
                onPress={() => {
                  setShowFolderModal(false);
                  setNewFolderName('');
                }}
                style={{ flex: 1 }}
              />
              <GlassButton
                variant="primary"
                size="large"
                title="Create"
                onPress={handleCreateFolder}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}