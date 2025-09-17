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
  Animated,
} from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MediaItem, getMediaByProject, updateMediaNote } from '../../../lib/db';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import LazyImage from '../../../components/LazyImage';
import { ImageVariants, getImageVariants, checkImageVariantsExist, generateImageVariants, cleanupImageVariants } from '../../../lib/imageOptimization';
import SharingQualitySelector from '../../../components/SharingQualitySelector';
import NotePrompt from '../../../components/NotePrompt';
import { shouldShowPrompt, markPromptShown } from '../../../components/NoteSettings';
import { GlassHeader, GlassCard, GlassActionSheet, ScrollProvider } from '../../../components/glass';
import ReanimatedAnimated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle } from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ZoomableImage component
function ZoomableImage({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const MIN_SCALE = 1;
  const MAX_SCALE = 4; // Increased max zoom for better experience

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
      
      // Apply scale constraints with smooth animation
      if (newScale < MIN_SCALE) {
        lastScale.current = MIN_SCALE;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        
        // Smooth animation back to original position
        Animated.parallel([
          Animated.spring(scale, {
            toValue: MIN_SCALE,
            useNativeDriver: true,
            tension: 120,
            friction: 9,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 9,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 9,
          }),
        ]).start();
      } else if (newScale > MAX_SCALE) {
        lastScale.current = MAX_SCALE;
        
        // Smooth animation to max scale
        Animated.spring(scale, {
          toValue: MAX_SCALE,
          useNativeDriver: true,
          tension: 120,
          friction: 9,
        }).start();
      } else {
        lastScale.current = newScale;
        
        // Smooth animation to new scale
        Animated.spring(scale, {
          toValue: newScale,
          useNativeDriver: true,
          tension: 120,
          friction: 9,
        }).start();
      }
    }
  };

  // Add double tap to reset zoom
  const handleDoubleTap = () => {
    lastScale.current = MIN_SCALE;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    
    Animated.parallel([
      Animated.spring(scale, {
        toValue: MIN_SCALE,
        useNativeDriver: true,
        tension: 120,
        friction: 9,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 9,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 9,
      }),
    ]).start();
  };

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Only allow panning when zoomed in
      if (lastScale.current > MIN_SCALE) {
        const newTranslateX = lastTranslateX.current + event.nativeEvent.translationX;
        const newTranslateY = lastTranslateY.current + event.nativeEvent.translationY;
        
        // Constrain panning to keep image visible
        const maxTranslateX = (screenWidth * (lastScale.current - 1)) / 2;
        const maxTranslateY = (screenHeight * (lastScale.current - 1)) / 2;
        
        lastTranslateX.current = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
        lastTranslateY.current = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));
        
        // Smooth animation to new position
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: lastTranslateX.current,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
          Animated.spring(translateY, {
            toValue: lastTranslateY.current,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]).start();
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
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTap}
              style={{ flex: 1 }}
            >
              <Animated.Image
                source={{ uri }}
                style={{
                  width: screenWidth,
                  height: screenHeight,
                  transform: [
                    { scale },
                    { translateX },
                    { translateY },
                  ],
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </PinchGestureHandler>
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
          width: screenWidth * 0.3, // Larger area on left side
          height: screenHeight,
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
          width: screenWidth * 0.3, // Larger area on right side
          height: screenHeight,
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
          left: screenWidth * 0.3,
          right: screenWidth * 0.3,
          height: screenHeight * 0.2, // Top 20% of screen
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
          left: screenWidth * 0.3,
          right: screenWidth * 0.3,
          height: screenHeight * 0.2, // Bottom 20% of screen
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
              Tap to show controls • Double-tap to reset zoom
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PhotoGalleryContent() {
  const { id, initialIndex } = useLocalSearchParams<{ id: string; initialIndex: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(parseInt(initialIndex || '0'));
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [note, setNote] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [imageVariants, setImageVariants] = useState<Map<string, ImageVariants>>(new Map());
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [sharingItem, setSharingItem] = useState<MediaItem | null>(null);
  const [showNotePrompt, setShowNotePrompt] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollY = useSharedValue(0);
  
  // Create Animated components
  const AnimatedFlatList = ReanimatedAnimated.createAnimatedComponent(FlatList);
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Load image variants for all photos
  const loadImageVariants = async (photos: MediaItem[]) => {
    if (!id) return;
    
    const variantsMap = new Map<string, ImageVariants>();
    
    for (const photo of photos) {
      try {
        // Check if variants already exist
        const variantsExist = await checkImageVariantsExist(photo.id, id);
        
        if (variantsExist) {
          // Load existing variants
          const existingVariants = await getImageVariants(photo.id, id, photo.uri);
          variantsMap.set(photo.id, existingVariants);
        } else {
          // Generate new variants in the background
          const newVariants = await generateImageVariants(photo.uri, id, photo.id);
          variantsMap.set(photo.id, newVariants);
        }
      } catch (error) {
        console.error('Error loading image variants for photo:', photo.id, error);
        // Fallback to original URI
        variantsMap.set(photo.id, {
          original: photo.uri,
          full: photo.uri,
          preview: photo.uri,
          thumbnail: photo.uri,
        });
      }
    }
    
    setImageVariants(variantsMap);
  };

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
          const currentPhoto = photos[parseInt(initialIndex || '0')];
          setNote(currentPhoto?.note || '');
          
          // Check if we should show note prompt for current photo
          if (currentPhoto && !currentPhoto.note) {
            const shouldShow = await shouldShowPrompt(currentPhoto.id);
            if (shouldShow) {
              setShowNotePrompt(true);
            }
          }
        }
        // Load image variants
        loadImageVariants(photos);
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
    // Show quality selector for photos
    if (mediaItem.type === 'photo') {
      setSharingItem(mediaItem);
      setShowQualitySelector(true);
    } else {
      // For other media types, share directly
      await shareMedia(mediaItem.uri);
    }
  };

  const shareMedia = async (uri: string) => {
    try {
      console.log('Starting share process for:', uri);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing not available on this device');
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        console.log('File does not exist:', uri);
        Alert.alert('Error', 'Photo file not found. Cannot share.');
        return;
      }

      console.log('Attempting to share file:', uri);
      
      // Ensure the URI is properly formatted
      const shareUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      console.log('Formatted share URI:', shareUri);
      
      // Share the photo with maximum quality preservation
      await Sharing.shareAsync(shareUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Photo',
        // Ensure no compression during sharing
        UTI: 'public.jpeg', // Use JPEG UTI for best quality
      });
      
      console.log('Share completed successfully');
    } catch (error) {
      console.error('Error sharing photo:', error);
      console.error('Error details:', {
        message: (error as Error).message,
        code: (error as any).code,
        uri: uri,
      });
      Alert.alert('Error', `Failed to share photo: ${(error as Error).message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleQualityShare = async (uri: string, quality: string) => {
    await shareMedia(uri);
  };

  const handleDelete = (mediaItem: MediaItem) => {
    setShowDeleteSheet(true);
  };
  
  const confirmDelete = async () => {
    const mediaItem = media[currentIndex];
    if (!mediaItem) return;
    
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

  const handleAddNote = () => {
    setIsEditingNote(true);
    setShowNotePrompt(false);
    if (media[currentIndex]) {
      markPromptShown(media[currentIndex].id);
    }
  };

  const handlePromptDismiss = () => {
    setShowNotePrompt(false);
    if (media[currentIndex]) {
      markPromptShown(media[currentIndex].id);
    }
  };

  const handleNeverShowAgain = () => {
    setShowNotePrompt(false);
    if (media[currentIndex]) {
      markPromptShown(media[currentIndex].id);
    }
    // TODO: Implement never show again logic
  };

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;

  const renderPhoto = ({ item, index }: { item: MediaItem; index: number }) => {
    const variants = imageVariants.get(item.id);
    
    return (
      <View style={{ width: screenWidth, height: screenHeight, position: 'relative' }}>
        {variants ? (
          <LazyImage
            variants={variants}
            style={{
              width: screenWidth,
              height: screenHeight - 200, // Leave space for header and controls
            }}
            contentFit="contain"
            progressiveLoading={true}
            priority="high"
          />
        ) : (
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
        )}
        
        {/* Full-screen button overlay with glass morphism */}
        <View style={{
          position: 'absolute',
          top: 120, // Below the header
          right: 16,
        }}>
          <GlassCard
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 25,
            }}
            intensity={60}
            shadowEnabled={true}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setIsFullScreen(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="expand" size={16} color="#F8FAFC" />
              <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '600' }}>
                Full Screen
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
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
      {/* Glass Header */}
      <GlassHeader
        title={`${currentIndex + 1} of ${media.length}`}
        onBack={() => router.back()}
        scrollY={scrollY}
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleShare(media[currentIndex])}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}
            >
              <Ionicons name="share" size={20} color="#3B82F6" />
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleDelete(media[currentIndex])}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(220, 38, 38, 0.3)',
              }}
            >
              <Ionicons name="trash" size={20} color="#DC2626" />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Photo Gallery */}
      <AnimatedFlatList
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

      {/* Bottom Controls with Glass Card */}
      <KeyboardAvoidingView 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <GlassCard
            style={{
              marginHorizontal: 0,
              borderRadius: 0,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
            intensity={80}
            shadowEnabled={false}
          >
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
            <AnimatedFlatList
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
          </GlassCard>
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

      {/* Quality selector for sharing */}
      {sharingItem && (
        <SharingQualitySelector
          variants={imageVariants.get(sharingItem.id) || {
            original: sharingItem.uri,
            full: sharingItem.uri,
            preview: sharingItem.uri,
            thumbnail: sharingItem.uri,
          }}
          onShare={handleQualityShare}
          onClose={() => {
            setShowQualitySelector(false);
            setSharingItem(null);
          }}
          visible={showQualitySelector}
        />
      )}

      {/* Note Prompt */}
      {media[currentIndex] && (
        <NotePrompt
          visible={showNotePrompt}
          mediaType={media[currentIndex].type}
          onAddNote={handleAddNote}
          onDismiss={handlePromptDismiss}
          onNeverShowAgain={handleNeverShowAgain}
        />
      )}
      
      {/* Delete Confirmation Sheet */}
      <GlassActionSheet
        visible={showDeleteSheet}
        onClose={() => setShowDeleteSheet(false)}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        actions={[
          {
            title: 'Delete Photo',
            style: 'destructive',
            onPress: () => {
              setShowDeleteSheet(false);
              confirmDelete();
            },
          },
          {
            title: 'Cancel',
            style: 'cancel',
            onPress: () => setShowDeleteSheet(false),
          },
        ]}
      />
    </View>
  );
}

export default function PhotoGallery() {
  return (
    <ScrollProvider>
      <PhotoGalleryContent />
    </ScrollProvider>
  );
}
