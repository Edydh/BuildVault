import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { MediaItem, getMediaById, updateMediaNote, deleteMedia } from '../../../../lib/db';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

// ZoomableImage component
function ZoomableImage({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const MIN_SCALE = 1;
  const MAX_SCALE = 3;

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale } }],
    { useNativeDriver: true }
  );

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = lastScale.current * event.nativeEvent.scale;
      
      // Apply scale constraints
      if (newScale < MIN_SCALE) {
        lastScale.current = MIN_SCALE;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        scale.setValue(MIN_SCALE);
        translateX.setValue(0);
        translateY.setValue(0);
      } else if (newScale > MAX_SCALE) {
        lastScale.current = MAX_SCALE;
        scale.setValue(MAX_SCALE);
      } else {
        lastScale.current = newScale;
        scale.setValue(newScale);
      }
    }
  };

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Only allow panning when zoomed in
      if (lastScale.current > MIN_SCALE) {
        lastTranslateX.current += event.nativeEvent.translationX;
        lastTranslateY.current += event.nativeEvent.translationY;
        translateX.setValue(lastTranslateX.current);
        translateY.setValue(lastTranslateY.current);
      }
    }
  };

  return (
    <PinchGestureHandler
      onGestureEvent={onPinchGestureEvent}
      onHandlerStateChange={onPinchHandlerStateChange}
    >
      <Animated.View style={{ flex: 1 }}>
        <PanGestureHandler
          onGestureEvent={onPanGestureEvent}
          onHandlerStateChange={onPanHandlerStateChange}
          minPointers={1}
          maxPointers={1}
        >
          <Animated.View style={{ flex: 1 }}>
            <Animated.Image
              source={{ uri }}
              style={{
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                transform: [
                  { scale },
                  { translateX },
                  { translateY },
                ],
              }}
              resizeMode="contain"
            />
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
  );
}

// VideoPlayer component using expo-video
function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={{
        width: Dimensions.get('window').width - 16,
        height: Dimensions.get('window').height * 0.7,
        borderRadius: 12,
      }}
      contentFit="contain"
      allowsFullscreen
      allowsPictureInPicture
      showsTimecodes={true}
    />
  );
}

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
      {/* Full-screen zoomable image */}
      <ZoomableImage uri={uri} />
      
      {/* Large touch areas for controls toggle - easier to access */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: Dimensions.get('window').width * 0.3, // Larger area on left side
          height: Dimensions.get('window').height,
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
          width: Dimensions.get('window').width * 0.3, // Larger area on right side
          height: Dimensions.get('window').height,
          backgroundColor: 'transparent',
        }}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      />

      {/* Top touch area for controls toggle */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 0,
          left: Dimensions.get('window').width * 0.3,
          right: Dimensions.get('window').width * 0.3,
          height: Dimensions.get('window').height * 0.2, // Top 20% of screen
          backgroundColor: 'transparent',
        }}
        activeOpacity={1}
        onPress={() => setShowControls(!showControls)}
      />

      {/* Bottom touch area for controls toggle */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 0,
          left: Dimensions.get('window').width * 0.3,
          right: Dimensions.get('window').width * 0.3,
          height: Dimensions.get('window').height * 0.2, // Bottom 20% of screen
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

      {/* Show tap indicator when controls are hidden */}
      {!showControls && (
        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Ionicons name="hand-left" size={16} color="#FFFFFF" />
            <Text style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: '500',
            }}>
              Tap to show controls
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function MediaDetail() {
  const { mediaId } = useLocalSearchParams<{ mediaId: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [note, setNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [fileExists, setFileExists] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  React.useEffect(() => {
    if (!mediaId) return;

    const loadMedia = async () => {
      try {
        const mediaData = getMediaById(mediaId);
        if (!mediaData) {
          Alert.alert('Error', 'Media not found');
          router.back();
          return;
        }

        // Check if the media file actually exists
        const fileInfo = await FileSystem.getInfoAsync(mediaData.uri);
        setFileExists(fileInfo.exists);

        setMedia(mediaData);
        setNote(mediaData.note || '');
      } catch (error) {
        console.error('Error loading media:', error);
        Alert.alert('Error', 'Failed to load media');
      }
    };

    loadMedia();
  }, [mediaId, router]);

  const handleShare = async () => {
    if (!media) return;

    try {
      console.log('Starting share process for media:', media.uri);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing not available on this device');
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Check if the file exists
      if (!fileExists) {
        console.log('Media file does not exist:', media.uri);
        Alert.alert('Error', 'Media file not found. Cannot share.');
        return;
      }

      // Ensure the URI is properly formatted
      const shareUri = media.uri.startsWith('file://') ? media.uri : `file://${media.uri}`;
      console.log('Formatted share URI:', shareUri);

      // Share the actual file with maximum quality preservation
      await Sharing.shareAsync(shareUri, {
        mimeType: media.type === 'photo' ? 'image/jpeg' : 'video/mp4',
        dialogTitle: `Share ${media.type === 'photo' ? 'Photo' : 'Video'}`,
        // Ensure no compression during sharing
        UTI: media.type === 'photo' ? 'public.jpeg' : 'public.mpeg-4',
      });

      console.log('Media share completed successfully');

    } catch (error) {
      console.error('Error sharing media:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        uri: media.uri,
        type: media.type
      });
      Alert.alert('Error', `Failed to share media: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleSaveNote = () => {
    if (!media) return;

    try {
      updateMediaNote(media.id, note);
      setMedia(prev => prev ? { ...prev, note } : null);
      setIsEditingNote(false);
      Alert.alert('Success', 'Note saved!');
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const handleDeleteMedia = () => {
    if (!media) return;

    const mediaTypeName = media.type === 'photo' ? 'photo' : 
                         media.type === 'video' ? 'video' : 'document';
    
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
              const fileInfo = await FileSystem.getInfoAsync(media.uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(media.uri, { idempotent: true });
              }
              
              // Delete thumbnail if it exists
              if (media.thumb_uri) {
                const thumbInfo = await FileSystem.getInfoAsync(media.thumb_uri);
                if (thumbInfo.exists) {
                  await FileSystem.deleteAsync(media.thumb_uri, { idempotent: true });
                }
              }
              
              // Delete from database
              deleteMedia(media.id);
              
              // Provide haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              Alert.alert('Success', `${mediaTypeName.charAt(0).toUpperCase() + mediaTypeName.slice(1)} deleted successfully!`);
              
              // Navigate back to project
              router.back();
              
            } catch (error) {
              console.error('Error deleting media:', error);
              Alert.alert('Error', 'Failed to delete media. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!media) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#94A3B8' }}>Loading media...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#0B0F14' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 60,
            paddingHorizontal: 16,
            paddingBottom: 20,
          }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#101826',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
            </TouchableOpacity>

            <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>
              {media.type.charAt(0).toUpperCase() + media.type.slice(1)}
            </Text>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={handleShare}
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
          
          <TouchableOpacity
            onPress={handleDeleteMedia}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#DC2626',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="trash" size={20} color="#F8FAFC" />
          </TouchableOpacity>
        </View>
          </View>

          {/* Media Preview */}
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#101826',
              marginHorizontal: 8,
              marginTop: 8,
              marginBottom: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#1F2A37',
              overflow: 'hidden',
              minHeight: 300,
            }}>
        {media.type === 'photo' && fileExists ? (
          <View style={{
            width: Dimensions.get('window').width - 16,
            height: Dimensions.get('window').height * 0.7,
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <Image
              source={{ uri: media.uri }}
              style={{
                width: '100%',
                height: '100%',
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
                top: 12,
                right: 12,
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
        ) : media.type === 'video' && fileExists && !media.uri.includes('placeholder') ? (
          <VideoPlayer uri={media.uri} />
        ) : media.type === 'video' && media.uri.includes('placeholder') ? (
          <View style={{ height: Dimensions.get('window').height * 0.7, width: Dimensions.get('window').width - 16, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' }}>
            {/* Video Preview Area */}
            <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
              {/* Large Play Button */}
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(255, 122, 26, 0.9)',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#FF7A1A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}>
                <Ionicons name="play" size={32} color="#0B0F14" style={{ marginLeft: 3 }} />
              </View>

              {/* Video Duration Badge */}
              <View style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
              }}>
                <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>
                  0:03
                </Text>
              </View>

              {/* Video Quality Badge */}
              <View style={{
                position: 'absolute',
                top: 20,
                right: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                  SIM
                </Text>
              </View>
            </View>

            {/* Video Controls */}
            <View style={{ height: 60, backgroundColor: '#101826', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
              {/* Play/Pause Button */}
              <TouchableOpacity style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#FF7A1A',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="play" size={20} color="#0B0F14" style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              {/* Progress Bar */}
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{
                  height: 4,
                  backgroundColor: '#374151',
                  borderRadius: 2,
                  marginBottom: 4,
                }}>
                  <View style={{
                    width: '100%',
                    height: 4,
                    backgroundColor: '#FF7A1A',
                    borderRadius: 2,
                  }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>0:00</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>0:03</Text>
                </View>
              </View>

              {/* Volume & Fullscreen */}
              <TouchableOpacity style={{ marginRight: 12 }}>
                <Ionicons name="volume-high" size={24} color="#F8FAFC" />
              </TouchableOpacity>
              <TouchableOpacity>
                <Ionicons name="expand" size={20} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            {/* Simulation Mode Overlay */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 60,
              backgroundColor: 'rgba(11, 15, 20, 0.85)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <View style={{
                backgroundColor: '#101826',
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#1F2A37',
              }}>
                <Ionicons name="videocam" size={48} color="#FF7A1A" />
                <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                  Video Simulation
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  This is a 3-second simulation.{'\n'}Real video recording coming soon!
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
                  <TouchableOpacity style={{
                    backgroundColor: '#374151',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}>
                    <Text style={{ color: '#F8FAFC', fontSize: 14 }}>
                      Demo Play
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{
                    backgroundColor: '#FF7A1A',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}>
                    <Text style={{ color: '#0B0F14', fontSize: 14, fontWeight: '600' }}>
                      Upgrade Soon
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : media.type === 'doc' ? (
          <View style={{ alignItems: 'center', padding: 20, justifyContent: 'center', height: Dimensions.get('window').height * 0.7, width: Dimensions.get('window').width - 16 }}>
            <Ionicons
              name="document"
              size={120}
              color="#FF7A1A"
            />
            <Text style={{ color: '#F8FAFC', marginTop: 20, textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
              Document
            </Text>
            <Text style={{ color: '#94A3B8', marginTop: 8, textAlign: 'center', fontSize: 14 }}>
              {media.note || 'Uploaded document'}
            </Text>
            {fileExists && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#FF7A1A',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginTop: 20,
                }}
                onPress={handleShare}
              >
                <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>
                  Open Document
                </Text>
              </TouchableOpacity>
            )}
            {!fileExists && (
              <Text style={{ color: '#64748B', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                Document file not found
              </Text>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 20, justifyContent: 'center', height: Dimensions.get('window').height * 0.7, width: Dimensions.get('window').width - 16 }}>
            <Ionicons
              name={media.type === 'photo' ? 'image' : media.type === 'video' ? 'videocam' : 'document'}
              size={120}
              color="#64748B"
            />
            <Text style={{ color: '#94A3B8', marginTop: 20, textAlign: 'center', fontSize: 16 }}>
              {!fileExists ? 'Media file not found' : 'Loading media...'}
            </Text>
            {!fileExists && (
              <Text style={{ color: '#64748B', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                The media file may have been deleted or moved
              </Text>
            )}
          </View>
        )}
      </View>

            {/* Note Section */}
            <View style={{ padding: 16, paddingBottom: 40 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                Notes
              </Text>

              {isEditingNote ? (
                <View>
                  <TextInput
                    style={{
                      backgroundColor: '#1F2A37',
                      borderRadius: 12,
                      padding: 16,
                      color: '#F8FAFC',
                      fontSize: 16,
                      minHeight: 120,
                      maxHeight: 200,
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
                    marginTop: 16,
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

              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: 16,
                paddingHorizontal: 4,
              }}>
                <Text style={{
                  color: '#64748B',
                  fontSize: 12,
                  flex: 1,
                }}>
                  Created {new Date(media.created_at).toLocaleString()}
                </Text>
                
                <TouchableOpacity
                  style={{
                    backgroundColor: '#DC2626',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onPress={handleDeleteMedia}
                >
                  <Ionicons name="trash" size={16} color="#F8FAFC" />
                  <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Full-screen photo viewer */}
      {isFullScreen && media && media.type === 'photo' && (
        <FullScreenPhotoViewer
          uri={media.uri}
          onClose={() => setIsFullScreen(false)}
          onShare={handleShare}
          onDelete={handleDeleteMedia}
        />
      )}
    </KeyboardAvoidingView>
  );
}
