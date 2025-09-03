import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MediaItem, getMediaByProject, getProjectById, deleteMedia, Project, createMedia } from '../../../lib/db';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { saveMediaToProject } from '../../../lib/files';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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

      // Get media for this project
      const mediaItems = getMediaByProject(id);
      setMedia(mediaItems);
    } catch (error) {
      console.error('Error loading project data:', error);
      Alert.alert('Error', 'Failed to load project data');
    }
  }, [id, router]);

  // Refresh data when returning from capture screen
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCaptureMedia = () => {
    Alert.alert(
      'Capture Media',
      'Choose media type',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => {
            // Navigate to capture screen with photo mode
            router.push(`/project/${id}/capture?mode=photo`);
          },
        },
        {
          text: 'Record Video',
          onPress: () => {
            // Navigate to capture screen with video mode
            router.push(`/project/${id}/capture?mode=video`);
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
      
      // Save document to project directory
      const { fileUri } = await saveMediaToProject(id!, document.uri, 'doc');
      
      // Save to database
      const mediaItem = createMedia({
        project_id: id!,
        type: 'doc',
        uri: fileUri,
        thumb_uri: null,
        note: `Uploaded: ${document.name}`,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      loadData();
      
      Alert.alert('Success', 'Document uploaded successfully!');
      
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
        version: '1.0.0',
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

  const MediaCard = ({ item }: { item: MediaItem }) => (
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
        // Navigate to media detail
        router.push(`/project/${id}/media/${item.id}`);
      }}
      onLongPress={() => handleDeleteMedia(item)}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: '#FF7A1A',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
          <Ionicons
            name={
              item.type === 'photo' ? 'image' :
              item.type === 'video' ? 'videocam' : 'document'
            }
            size={20}
            color="#0B0F14"
          />
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
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      </View>
    </TouchableOpacity>
  );

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#94A3B8' }}>Loading project...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      {/* Header */}
      <View style={{ padding: 16, paddingTop: 60, paddingBottom: 20 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: 'absolute',
            top: 60,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#101826',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 'bold' }}>
            {project.name}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
            Project Details
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShareProject}
          style={{
            position: 'absolute',
            top: 60,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#101826',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <Ionicons name="share" size={20} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {/* Media List */}
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => <MediaCard item={item} />}
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
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 20,
          bottom: 20,
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
        onPress={handleCaptureMedia}
        activeOpacity={0.9}
      >
        <Ionicons name="camera" size={30} color="#0B0F14" />
      </TouchableOpacity>
    </View>
  );
}