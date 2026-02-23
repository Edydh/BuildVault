import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { createMediaInSupabase, deleteMediaInSupabase } from '../../../lib/supabaseProjectsSync';
import { saveMediaToProject } from '../../../lib/files';
import { deleteLocalFileIfPresent, isRemoteMediaUri } from '../../../lib/mediaFileAccess';

type MediaStorageSyncState = 'synced' | 'pending' | 'blocked';

type MediaStorageSyncOutcome = {
  state: MediaStorageSyncState;
  blockedReason: string | null;
};

function parseMediaMetadata(metadata: string | null | undefined): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function getMediaStorageSyncOutcome(media: {
  uri: string;
  metadata?: string | null;
}): MediaStorageSyncOutcome {
  const metadata = parseMediaMetadata(media.metadata);
  const storage =
    metadata?.storage && typeof metadata.storage === 'object' && !Array.isArray(metadata.storage)
      ? (metadata.storage as Record<string, unknown>)
      : null;

  const blocked = storage?.upload_blocked === true;
  const pending = storage?.upload_pending === true;
  const blockedReason =
    typeof storage?.upload_block_reason === 'string' ? storage.upload_block_reason.trim().toLowerCase() : null;

  if (blocked) {
    return { state: 'blocked', blockedReason };
  }
  if (pending || !isRemoteMediaUri(media.uri)) {
    return { state: 'pending', blockedReason: null };
  }
  return { state: 'synced', blockedReason: null };
}

export default function CaptureScreen() {
  const { id, mode, folderId, captureKind } = useLocalSearchParams<{
    id: string;
    mode: string;
    folderId?: string;
    captureKind?: string;
  }>();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const isReceiptCapture = mode === 'photo' && captureKind === 'receipt';
  
  // All hooks must be called unconditionally at the top
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSliderActive, setIsSliderActive] = useState(false);
  
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const zoomSliderRef = useRef(new Animated.Value(0)).current;
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const getSavedInLocationMessage = useCallback(
    (mediaLabel: string) =>
      folderId
        ? `Your ${mediaLabel} has been saved to the selected folder.`
        : `Your ${mediaLabel} has been saved to the project.`,
    [folderId]
  );
  const showMediaSaveOutcome = useCallback(
    (params: {
      mediaLabel: string;
      mediaId: string;
      localFileUri: string;
      localThumbUri?: string | null;
      metadata?: string | null;
      uri: string;
    }) => {
      const outcome = getMediaStorageSyncOutcome({
        uri: params.uri,
        metadata: params.metadata,
      });
      const savedMessage = getSavedInLocationMessage(params.mediaLabel);

      if (outcome.state === 'blocked') {
        const blockedMessage =
          outcome.blockedReason === 'payload_too_large'
            ? `This ${params.mediaLabel} is too large for cloud sync right now. It will stay on this device only.`
            : `Cloud sync is currently blocked for this ${params.mediaLabel}. It will stay on this device only.`;
        Alert.alert('Saved Locally', `${savedMessage}\n\n${blockedMessage}`, [
          { text: 'Keep Local', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteLocalFileIfPresent(params.localFileUri);
                await deleteLocalFileIfPresent(params.localThumbUri || null);
                await deleteMediaInSupabase(params.mediaId);
                Alert.alert('Deleted', `The ${params.mediaLabel} was removed from this project.`);
              } catch (deleteError) {
                console.error('Delete blocked media error:', deleteError);
                Alert.alert('Delete Failed', `Could not remove this ${params.mediaLabel}. Please try again.`);
              }
            },
          },
        ]);
        return;
      }

      if (outcome.state === 'pending') {
        Alert.alert(
          `${params.mediaLabel.charAt(0).toUpperCase() + params.mediaLabel.slice(1)} Saved`,
          `${savedMessage}\n\nCloud sync is pending and will retry automatically.`
        );
        return;
      }

      Alert.alert(`${params.mediaLabel.charAt(0).toUpperCase() + params.mediaLabel.slice(1)} Saved`, savedMessage);
    },
    [getSavedInLocationMessage]
  );

  type CameraRecorder = {
    recordAsync: (options: {
      maxDuration: number;
      quality: string;
      mute: boolean;
      mirror: boolean;
      codec: string;
      bitrate: number;
      fps: number;
      maxFileSize?: number;
    }) => Promise<{ uri: string }>;
    stopRecording: () => void;
  };

  const getCameraRecorder = (): CameraRecorder | null => {
    const candidate = cameraRef.current as unknown as Partial<CameraRecorder> | null;
    if (
      candidate &&
      typeof candidate.recordAsync === 'function' &&
      typeof candidate.stopRecording === 'function'
    ) {
      return candidate as CameraRecorder;
    }
    return null;
  };

  // Zoom functions with smooth animation
  const zoomIn = useCallback(() => {
    const newZoom = Math.min(1, zoom + 0.05);
    setZoom(newZoom);
    lastScale.current = newZoom;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [zoom, scale]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(0, zoom - 0.05);
    setZoom(newZoom);
    lastScale.current = newZoom;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [zoom, scale]);

  // Recording functions with better error handling
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !id) {
      console.log('Camera ref or id not available');
      return;
    }

    try {
      console.log('Starting video recording...');
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Check if recordAsync is available
      const recorder = getCameraRecorder();
      if (!recorder) {
        throw new Error('Recording not supported on this device');
      }

      // Wait a bit to ensure camera is ready
      await new Promise(resolve => setTimeout(resolve, 500));

      const isAndroid = Platform.OS === 'android';
      const video = await recorder.recordAsync({
        maxDuration: isAndroid ? 20 : 30,
        quality: isAndroid ? '480p' : '1080p',
        mute: false,
        mirror: facing === 'front',
        codec: 'avc1',
        bitrate: isAndroid ? 1800000 : 8000000,
        fps: isAndroid ? 24 : 30,
        maxFileSize: isAndroid ? 20 * 1024 * 1024 : undefined,
      });

      console.log('Video recorded:', video);

      // Stop the timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      if (video && video.uri) {
        // Save video
        console.log('Saving video to project...');
        const { fileUri, thumbUri } = await saveMediaToProject(id, video.uri, 'video');
        const createdMedia = await createMediaInSupabase({
          project_id: id,
          uri: fileUri,
          thumb_uri: thumbUri,
          type: 'video',
          folder_id: folderId || null, // Associate with folder if provided
        });

        console.log('Video saved successfully:', fileUri);
        showMediaSaveOutcome({
          mediaLabel: 'video',
          mediaId: createdMedia.id,
          localFileUri: fileUri,
          localThumbUri: thumbUri,
          metadata: createdMedia.metadata,
          uri: createdMedia.uri,
        });
      } else {
        throw new Error('No video data received');
      }
    } catch (error) {
      console.error('Video recording error:', error);
      Alert.alert(
        'Recording Failed',
        `Unable to record video: ${(error as Error).message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [id, facing, folderId, showMediaSaveOutcome]);

  const stopRecording = useCallback(() => {
    const recorder = getCameraRecorder();
    if (recorder) {
      recorder.stopRecording();
    }
  }, []);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !id) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        exif: true,
        base64: false,
      });

      if (!photo) {
        Alert.alert('Error', 'Failed to capture photo');
        return;
      }

      const { fileUri, thumbUri } = await saveMediaToProject(id, photo.uri, 'photo');
      const createdMedia = await createMediaInSupabase({
        project_id: id,
        uri: fileUri,
        thumb_uri: thumbUri,
        type: 'photo',
        folder_id: folderId || null, // Associate with folder if provided
        note: isReceiptCapture ? 'Receipt captured' : null,
        metadata: isReceiptCapture
          ? {
              capture_kind: 'receipt',
              document_kind: 'receipt',
              captured_at: Date.now(),
            }
          : {
              capture_kind: 'camera',
            },
      });

      showMediaSaveOutcome({
        mediaLabel: isReceiptCapture ? 'receipt' : 'photo',
        mediaId: createdMedia.id,
        localFileUri: fileUri,
        localThumbUri: thumbUri,
        metadata: createdMedia.metadata,
        uri: createdMedia.uri,
      });
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', isReceiptCapture ? 'Failed to capture receipt' : 'Failed to capture photo');
    }
  }, [id, folderId, isReceiptCapture, showMediaSaveOutcome]);

  const toggleFlash = useCallback(() => {
    setFlash(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing(current => current === 'back' ? 'front' : 'back');
  }, []);

  // Zoom gesture handlers
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: { nativeEvent: { state: number; scale: number } }) => {
    if (event.nativeEvent.state === State.BEGAN) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (event.nativeEvent.state === State.ACTIVE) {
      const newScale = lastScale.current * event.nativeEvent.scale;
      const clampedScale = Math.max(0, Math.min(1, newScale));
      setZoom(clampedScale);
      scale.setValue(clampedScale);
    } else if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      const newScale = lastScale.current * event.nativeEvent.scale;
      const clampedScale = Math.max(0, Math.min(1, newScale));
      lastScale.current = clampedScale;
      setZoom(clampedScale);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Render camera permission denied
  if (!cameraPermission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="camera" size={64} color="#64748B" style={{ marginBottom: 20 }} />
        <Text style={{ color: '#F8FAFC', fontSize: 18, textAlign: 'center', marginBottom: 10 }}>
          Camera Access Required
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
          BuildVault needs camera access to capture photos and videos for your projects.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#FF7A1A',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 12,
          }}
          onPress={requestCameraPermission}
        >
          <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>
            Grant Camera Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render microphone permission denied for video mode
  if (!microphonePermission?.granted && mode === 'video') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="mic" size={64} color="#64748B" style={{ marginBottom: 20 }} />
        <Text style={{ color: '#F8FAFC', fontSize: 18, textAlign: 'center', marginBottom: 10 }}>
          Microphone Access Required
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
          BuildVault needs microphone access to record audio in your videos.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#FF7A1A',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 12,
          }}
          onPress={requestMicrophonePermission}
        >
          <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>
            Grant Microphone Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: 'rgba(11, 15, 20, 0.9)',
        zIndex: 20,
      }}>
        <TouchableOpacity
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(148, 163, 184, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
          }}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color="#F8FAFC" />
        </TouchableOpacity>

        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>
          {mode === 'photo' ? (isReceiptCapture ? 'Capture Receipt' : 'Take Photo') : 'Record Video'}
        </Text>
      </View>

      {/* Camera View */}
      <View style={{ flex: 1 }}>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
        >
          <Animated.View style={{ flex: 1 }}>
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing={facing}
              flash={flash}
              mode={mode === 'video' ? 'video' : 'picture'}
              zoom={Math.max(0, Math.min(1, zoom))}
              onCameraReady={() => {
                console.log('Camera is ready');
              }}
            />
          </Animated.View>
        </PinchGestureHandler>

        {/* Simple Controls */}
        <View style={{
          position: 'absolute',
          top: 60,
          left: 20,
          right: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <TouchableOpacity
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(11, 15, 20, 0.7)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={toggleFlash}
          >
            <Ionicons 
              name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'} 
              size={24} 
              color="#F8FAFC" 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(11, 15, 20, 0.7)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={toggleFacing}
          >
            <Ionicons name="camera-reverse" size={24} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {/* Zoom Controls */}
        <View style={{
          position: 'absolute',
          top: 120,
          right: 20,
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <TouchableOpacity
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(11, 15, 20, 0.7)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 10,
            }}
            onPress={zoomIn}
            disabled={zoom >= 1}
          >
            <Ionicons name="add" size={24} color={zoom >= 1 ? "#64748B" : "#F8FAFC"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(11, 15, 20, 0.7)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={zoomOut}
            disabled={zoom <= 0}
          >
            <Ionicons name="remove" size={24} color={zoom <= 0 ? "#64748B" : "#F8FAFC"} />
          </TouchableOpacity>
        </View>

        {/* Zoom Indicator */}
        {!isRecording && (
          <View style={{
            position: 'absolute',
            top: 120,
            left: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            zIndex: 10,
          }}>
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>
              {Math.round((1 + zoom) * 10) / 10}x
            </Text>
          </View>
        )}

        {/* Enhanced Zoom Slider for Video Recording - Better positioned and smoother */}
        {mode === 'video' && (
          <View style={{
            position: 'absolute',
            bottom: 150, // Better position - above record button
            left: 40,
            right: 40,
            alignItems: 'center',
            zIndex: 10,
          }}>
            <Text style={{ 
              color: '#94A3B8', 
              fontSize: 11, 
              marginBottom: 12,
              textAlign: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              Drag to zoom smoothly
            </Text>
            <View style={{
              width: 180,
              height: 6, // Slightly thicker for better touch
              backgroundColor: 'rgba(148, 163, 184, 0.4)',
              borderRadius: 3,
              position: 'relative',
            }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: 6,
                  width: zoomSliderRef.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 180],
                  }),
                  backgroundColor: isSliderActive ? '#FF7A1A' : '#94A3B8',
                  borderRadius: 3,
                }}
              />
              <Animated.View
                style={{
                  position: 'absolute',
                  left: zoomSliderRef.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 168], // Adjusted for new width
                  }),
                  top: -9,
                  width: 24,
                  height: 24,
                  backgroundColor: isSliderActive ? '#FF7A1A' : '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 3,
                  borderColor: isSliderActive ? '#FF7A1A' : '#94A3B8',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.4,
                  shadowRadius: 6,
                  elevation: 8,
                }}
                {...{
                  onStartShouldSetResponder: () => true,
                  onMoveShouldSetResponder: () => true,
                  onResponderGrant: (_evt) => {
                    setIsSliderActive(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  },
                  onResponderMove: (evt) => {
                    try {
                      const sliderWidth = 180;
                      const touchX = evt.nativeEvent.locationX;
                      
                      // Add smoothing and bounds checking
                      const progress = Math.max(0, Math.min(1, touchX / sliderWidth));
                      const newZoom = progress; // 0 to 1 normalized zoom
                      
                      // Smooth the zoom changes to prevent jerkiness
                      setZoom(newZoom);
                      lastScale.current = newZoom;
                      
                      // Use smooth animation for camera zoom
                      Animated.timing(scale, {
                        toValue: newZoom,
                        duration: 50, // Very short duration for responsiveness
                        useNativeDriver: true,
                      }).start();
                      
                      // Update slider position smoothly
                      Animated.timing(zoomSliderRef, {
                        toValue: progress,
                        duration: 50,
                        useNativeDriver: false,
                      }).start();
                      
                    } catch (error) {
                      console.error('Zoom slider error:', error);
                    }
                  },
                  onResponderRelease: () => {
                    setIsSliderActive(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  },
                }}
              />
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: 180,
              marginTop: 8,
            }}>
              <Text style={{ 
                color: '#94A3B8', 
                fontSize: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>1x</Text>
              <Text style={{ 
                color: '#94A3B8', 
                fontSize: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>2x</Text>
            </View>
          </View>
        )}

        {/* Recording Timer with Zoom Level */}
        {isRecording && (
          <View
            style={{
              position: 'absolute',
              top: 120,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 12,
              pointerEvents: 'none',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#F8FAFC',
                  marginRight: 8,
                }}
              />
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </Text>
              <View
                style={{
                  marginLeft: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '600' }}>
                  {Math.round((1 + zoom) * 10) / 10}x
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Controls */}
        <View style={{
          position: 'absolute',
          bottom: 50,
          left: 20,
          right: 20,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}>
          {mode === 'photo' ? (
            <TouchableOpacity
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#F8FAFC',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 4,
                borderColor: '#E2E8F0',
              }}
              onPress={takePicture}
            >
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#0B0F14',
              }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: isRecording ? '#DC2626' : '#F8FAFC',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 4,
                borderColor: isRecording ? '#B91C1C' : '#E2E8F0',
              }}
              onPress={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <View style={{
                  width: 30,
                  height: 30,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 4,
                }} />
              ) : (
                <View style={{
                  width: 0,
                  height: 0,
                  backgroundColor: 'transparent',
                  borderStyle: 'solid',
                  borderLeftWidth: 20,
                  borderRightWidth: 0,
                  borderTopWidth: 12,
                  borderBottomWidth: 12,
                  borderLeftColor: '#0B0F14',
                  borderRightColor: 'transparent',
                  borderTopColor: 'transparent',
                  borderBottomColor: 'transparent',
                  marginLeft: 4,
                }} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
