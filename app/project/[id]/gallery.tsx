import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MediaItem, getMediaByProject, updateMediaNote } from '../../../lib/db';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// FullScreenPhotoViewer component
function FullScreenPhotoViewer({ 
  uri, 
  onClose, 
  onShare, 
  onDelete 
}: { 
  uri: string; 
  onClose: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [showControls, setShowControls] = useState(true);

  React.useEffect(() => {
    // Auto-hide controls after 3 seconds
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls]);

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000000',
      zIndex: 1000,
    }}>
      {/* Full-screen image */}
      <Image
        source={{ uri }}
        style={{
          width: screenWidth,
          height: screenHeight,
        }}
        contentFit="contain"
        placeholder={null}
        enableLiveTextInteraction={true}
      />
      
      {/* Small touch areas for controls toggle - only in corners to avoid Live Text interference */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 60, // Small area in top-left corner
          height: 60,
          backgroundColor: 'transparent',
        }}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      />
      
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 60, // Small area in top-right corner
          height: 60,
          backgroundColor: 'transparent',
        }}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      />

      {/* Top controls - always visible when controls are shown */}
      {showControls && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 60,
          paddingHorizontal: 16,
          paddingBottom: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 18, 
              fontWeight: '600',
              textAlign: 'center',
            }}>
              Full Screen
            </Text>

            <View style={{ width: 40 }} />
          </View>
        </View>
      )}

      {/* Bottom controls - only show as floating buttons, not full overlay */}
      {showControls && (
        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
        }}>
          <TouchableOpacity
            onPress={onShare}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(59, 130, 246, 0.9)',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Ionicons name="share" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={onDelete}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(220, 38, 38, 0.9)',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Ionicons name="trash" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function PhotoGallery() {
  const { id, initialIndex } = useLocalSearchParams<{ id: string; initialIndex: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(parseInt(initialIndex || '0'));
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [note, setNote] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  React.useEffect(() => {
    if (!id) return;

    const loadMedia = async () => {
      try {
        const allMedia = getMediaByProject(id);
        // Filter only photos for the gallery
        const photos = allMedia.filter(item => item.type === 'photo');
        setMedia(photos);
        // Set initial note for the first photo
        if (photos.length > 0) {
          setNote(photos[parseInt(initialIndex || '0')]?.note || '');
        }
      } catch (error) {
        console.error('Error loading media:', error);
        Alert.alert('Error', 'Failed to load photos');
      }
    };

    loadMedia();
  }, [id]);

  React.useEffect(() => {
    // Scroll to initial index when media is loaded
    if (media.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: currentIndex,
          animated: false,
        });
      }, 100);
    }
  }, [media, currentIndex]);

  const handleShare = async (mediaItem: MediaItem) => {
    try {
      console.log('Starting share process for:', mediaItem.uri);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing not available on this device');
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(mediaItem.uri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        console.log('File does not exist:', mediaItem.uri);
        Alert.alert('Error', 'Photo file not found. Cannot share.');
        return;
      }

      console.log('Attempting to share file:', mediaItem.uri);
      
      // Ensure the URI is properly formatted
      const shareUri = mediaItem.uri.startsWith('file://') ? mediaItem.uri : `file://${mediaItem.uri}`;
      console.log('Formatted share URI:', shareUri);
      
      // Share the photo
      await Sharing.shareAsync(shareUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Photo',
      });
      
      console.log('Share completed successfully');
    } catch (error) {
      console.error('Error sharing photo:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        uri: mediaItem.uri,
        type: mediaItem.type
      });
      Alert.alert('Error', `Failed to share photo: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleDelete = (mediaItem: MediaItem) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo? This action cannot be undone.',
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
              const { deleteMedia } = await import('../../../lib/db');
              deleteMedia(mediaItem.id);
              
              // Provide haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              // Remove from local state
              setMedia(prev => prev.filter(item => item.id !== mediaItem.id));
              
              // If this was the last photo, go back
              if (media.length === 1) {
                router.back();
              } else {
                // Adjust current index if needed
                const newIndex = Math.min(currentIndex, media.length - 2);
                setCurrentIndex(newIndex);
                if (flatListRef.current) {
                  flatListRef.current.scrollToIndex({
                    index: newIndex,
                    animated: true,
                  });
                }
              }
              
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', 'Failed to delete photo. Please try again.');
            }
          },
        },
      ]
    );
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        // Update note when changing photos
        setNote(media[newIndex]?.note || '');
        setIsEditingNote(false);
      }
    }
  }).current;

  const handleSaveNote = () => {
    if (!media[currentIndex]) return;

    try {
      updateMediaNote(media[currentIndex].id, note);
      setMedia(prev => prev.map((item, index) => 
        index === currentIndex ? { ...item, note } : item
      ));
      setIsEditingNote(false);
      Alert.alert('Success', 'Note saved!');
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;

  const renderPhoto = ({ item, index }: { item: MediaItem; index: number }) => {
    return (
      <View style={{ width: screenWidth, height: screenHeight, position: 'relative' }}>
        <Image
          source={{ uri: item.uri }}
          style={{
            width: screenWidth,
            height: screenHeight - 200, // Leave space for header and controls
          }}
          contentFit="contain"
          placeholder={null}
          enableLiveTextInteraction={true}
        />
        
        {/* Full-screen button overlay */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setIsFullScreen(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{
            position: 'absolute',
            top: 120, // Below the header
            right: 16,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 25,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons name="expand" size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
            Full Screen
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (media.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="images" size={64} color="#64748B" style={{ marginBottom: 20 }} />
        <Text style={{ color: '#94A3B8', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
          No photos found
        </Text>
        <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center' }}>
          This project doesn't have any photos yet
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#FF7A1A',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            marginTop: 20,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      {/* Header */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(11, 15, 20, 0.9)',
        paddingTop: 60,
        paddingHorizontal: 16,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(16, 24, 38, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
        </TouchableOpacity>

        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>
          {currentIndex + 1} of {media.length}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleShare(media[currentIndex])}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(16, 24, 38, 0.8)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="share" size={20} color="#F8FAFC" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => handleDelete(media[currentIndex])}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(220, 38, 38, 0.8)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="trash" size={20} color="#F8FAFC" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo Gallery */}
      <FlatList
        ref={flatListRef}
        data={media}
        keyExtractor={(item) => item.id}
        renderItem={renderPhoto}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        initialScrollIndex={currentIndex}
        style={{ flex: 1 }}
      />

      {/* Bottom Controls */}
      <KeyboardAvoidingView 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(11, 15, 20, 0.9)',
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 40 }}>
            {/* Photo Info */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              {isEditingNote ? (
                <View style={{ width: '100%', marginBottom: 16 }}>
                  <TextInput
                    style={{
                      backgroundColor: '#1F2A37',
                      borderRadius: 12,
                      padding: 16,
                      color: '#F8FAFC',
                      fontSize: 16,
                      minHeight: 60,
                      maxHeight: 120,
                      textAlignVertical: 'top',
                      borderWidth: 1,
                      borderColor: '#FF7A1A',
                    }}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a note..."
                    placeholderTextColor="#64748B"
                    multiline
                    autoFocus
                    returnKeyType="default"
                    blurOnSubmit={false}
                  />
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    marginTop: 12,
                    paddingHorizontal: 4,
                  }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#374151',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                        flex: 1,
                        marginRight: 8,
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        setIsEditingNote(false);
                        setNote(media[currentIndex]?.note || '');
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#FF7A1A',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                        flex: 1,
                        marginLeft: 8,
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        handleSaveNote();
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>Save Note</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#1F2A37',
                    borderRadius: 12,
                    padding: 16,
                    minHeight: 60,
                    borderWidth: 1,
                    borderColor: 'transparent',
                    width: '100%',
                    marginBottom: 16,
                  }}
                  onPress={() => setIsEditingNote(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{
                      color: note ? '#F8FAFC' : '#64748B',
                      fontSize: 16,
                      lineHeight: 24,
                      flex: 1,
                    }}>
                      {note || 'Tap to add a note...'}
                    </Text>
                    <Ionicons 
                      name="create-outline" 
                      size={20} 
                      color={note ? '#FF7A1A' : '#64748B'} 
                    />
                  </View>
                </TouchableOpacity>
              )}
              
              <Text style={{ color: '#94A3B8', fontSize: 14 }}>
                {new Date(media[currentIndex]?.created_at || 0).toLocaleString()}
              </Text>
            </View>

            {/* Thumbnail Strip */}
            <FlatList
              data={media}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={{
                    marginRight: 8,
                    borderRadius: 8,
                    borderWidth: currentIndex === index ? 2 : 0,
                    borderColor: '#FF7A1A',
                    overflow: 'hidden',
                  }}
                  onPress={() => {
                    setCurrentIndex(index);
                    flatListRef.current?.scrollToIndex({
                      index,
                      animated: true,
                    });
                  }}
                >
                  <Image
                    source={{ uri: item.thumb_uri || item.uri }}
                    style={{
                      width: 60,
                      height: 60,
                    }}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Full-screen photo viewer */}
      {isFullScreen && media[currentIndex] && (
        <FullScreenPhotoViewer
          uri={media[currentIndex].uri}
          onClose={() => setIsFullScreen(false)}
          onShare={() => handleShare(media[currentIndex])}
          onDelete={() => handleDelete(media[currentIndex])}
        />
      )}
    </View>
  );
}
