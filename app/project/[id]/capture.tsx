import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { createMedia } from '../../../lib/db';
import { saveMediaToProject } from '../../../lib/files';

export default function CaptureScreen() {
  const { id, mode, folderId } = useLocalSearchParams<{ id: string; mode: string; folderId?: string }>();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Zoom functionality
  const [zoom, setZoom] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const MIN_ZOOM = 0;
  const MAX_ZOOM = 1;

  if (!permission || !microphonePermission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#94A3B8' }}>Loading permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
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
          onPress={requestPermission}
        >
          <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>
            Grant Camera Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!microphonePermission.granted && mode === 'video') {
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

  const takePicture = async () => {
    if (!cameraRef.current || !id) return;

    try {
      // Take the picture with maximum quality settings
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0, // Maximum quality (100%)
        exif: true,   // Preserve EXIF data for better image quality
        base64: false, // Don't include base64 to avoid memory issues
        skipProcessing: false, // Allow full image processing
        // Additional quality settings for maximum resolution
        imageType: 'jpg', // Use JPEG format for best compatibility
        additionalExif: {
          // Preserve additional metadata for quality
          'ImageDescription': 'BuildVault Construction Photo',
          'Software': 'BuildVault App'
        }
      });

      if (!photo) {
        Alert.alert('Error', 'Failed to capture photo');
        return;
      }

      // Save to project directory
      const { fileUri, thumbUri } = await saveMediaToProject(id, photo.uri, 'photo');

      // Save to database
      const mediaItem = createMedia({
        project_id: id,
        folder_id: folderId || null,
        type: 'photo',
        uri: fileUri,
        thumb_uri: thumbUri,
        note: null,
      });

      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Show success and navigate back
      Alert.alert(
        'Photo Saved!',
        'Your photo has been added to the project.',
        [
          {
            text: 'Take Another',
            style: 'default',
          },
          {
            text: 'Done',
            style: 'default',
            onPress: () => router.back(),
          },
        ]
      );

    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Error', 'Failed to save photo. Please try again.');
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !id) return;

    // Check if camera is ready before starting recording
    if (!cameraReady) {
      Alert.alert('Camera Not Ready', 'Please wait for the camera to initialize before recording.');
      return;
    }

    // Check if microphone permission is granted for video recording
    if (!microphonePermission?.granted) {
      Alert.alert(
        'Microphone Permission Required',
        'Video recording requires microphone access. Please grant permission to continue.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Permission', onPress: requestMicrophonePermission }
        ]
      );
      return;
    }

    try {
      setIsRecording(true);

      // Start recording timer
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Try to use Expo Camera recording if available
      if (cameraRef.current && 'recordAsync' in cameraRef.current) {
        try {
          // Wait a bit more to ensure camera is fully ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // For newer Expo Camera versions that support recording
          const video = await (cameraRef.current as any).recordAsync({
            maxDuration: 30, // 30 seconds max
            quality: '1080p', // Maximum quality video (1080p)
            mute: false,
            mirror: facing === 'front',
            // Additional quality settings
            codec: 'avc1', // H.264 codec (correct enum value)
            bitrate: 10000000, // High bitrate for better quality (10 Mbps)
            fps: 30, // Standard frame rate
          });

          // Stop the timer
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }

          // Handle the recorded video
          await handleRecordedVideo(video.uri);

        } catch (recordError) {
          console.error('Camera recording failed:', recordError);
          Alert.alert(
            'Recording Failed',
            'Unable to start video recording. Please check your permissions and try again.',
            [{ text: 'OK' }]
          );
          cleanupRecording();
          return;
        }
      } else {
        Alert.alert(
          'Recording Not Supported',
          'Video recording is not available on this device. Please try taking photos instead.',
          [{ text: 'OK' }]
        );
        cleanupRecording();
        return;
      }

    } catch (error) {
      console.error('Video recording setup error:', error);
      Alert.alert('Error', 'Failed to start video recording');
      cleanupRecording();
    }
  };



  const handleRecordedVideo = async (videoUri: string) => {
    try {
      setIsRecording(false);
      setRecordingTime(0);

      // Save the recorded video to project directory
      const { fileUri, thumbUri } = await saveMediaToProject(id, videoUri, 'video');

      // Save to database
      const mediaItem = createMedia({
        project_id: id,
        folder_id: folderId || null,
        type: 'video',
        uri: fileUri,
        thumb_uri: thumbUri,
        note: `Recorded video - ${recordingTime}s`,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      Alert.alert(
        '✅ Video Recorded!',
        `Your video has been saved to the project.\n\n📹 Duration: ${recordingTime} seconds\n🎬 Format: MP4\n💾 Size: ~${Math.round((recordingTime * 0.5))}MB\n\nVideo playback available!`,
        [
          {
            text: '🎥 Record Another',
            style: 'default',
          },
          {
            text: '✅ Done',
            style: 'default',
            onPress: () => router.back(),
          },
        ]
      );

    } catch (error) {
      console.error('Video save error:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
      cleanupRecording();
    }
  };

  const cleanupRecording = () => {
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !id) return;

    try {
      setIsRecording(false);

      // Clear any active recording timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Check if we can stop camera recording
      if ('stopRecording' in cameraRef.current) {
        try {
          const video = await (cameraRef.current as any).stopRecording();
          if (video?.uri) {
            await handleRecordedVideo(video.uri);
            return;
          }
        } catch (stopError) {
          console.log('Stop recording failed:', stopError);
        }
      }

      // If we reach here, recording wasn't successful
      Alert.alert(
        'Recording Failed',
        'Unable to stop video recording. The video may not have been saved properly.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Video save error:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
      cleanupRecording();
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  // Enhanced zoom gesture handlers
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = lastScale.current * event.nativeEvent.scale;
      const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
      
      lastScale.current = clampedScale;
      
      // Smooth animation to new scale
      Animated.spring(scale, {
        toValue: clampedScale,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
      // Update zoom state for camera
      setZoom(clampedScale);
    }
  };

  const resetZoom = () => {
    lastScale.current = 1;
    setZoom(0);
    
    // Smooth animation back to normal
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const zoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, zoom + 0.1);
    setZoom(newZoom);
    lastScale.current = newZoom;
    
    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const zoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, zoom - 0.1);
    setZoom(newZoom);
    lastScale.current = newZoom;
    
    Animated.spring(scale, {
      toValue: newZoom,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 16,
        paddingBottom: 20,
        backgroundColor: '#0B0F14',
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
            marginRight: 16,
          }}
        >
          <Ionicons name="close" size={20} color="#F8FAFC" />
        </TouchableOpacity>

        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>
          {mode === 'photo' ? 'Take Photo' : 'Record Video'}
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
              videoQuality="1080p"
              // Enhanced quality settings
              pictureSize="max" // Use maximum available picture size
              enableTorch={flash === 'on'}
              zoom={zoom} // Add zoom support
              onCameraReady={() => {
                console.log('Camera is ready');
                setCameraReady(true);
              }}
            />
          </Animated.View>
        </PinchGestureHandler>

        {/* Top Controls */}
        <View style={{
          position: 'absolute',
          top: 100,
          left: 20,
          right: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
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
              name={
                flash === 'off' ? 'flash-off' :
                flash === 'on' ? 'flash' : 'flash-outline'
              }
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
            onPress={toggleCameraFacing}
          >
            <Ionicons name="camera-reverse" size={24} color="#F8FAFC" />
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
            disabled={zoom <= MIN_ZOOM}
          >
            <Ionicons name="remove" size={24} color={zoom <= MIN_ZOOM ? "#64748B" : "#F8FAFC"} />
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
            onPress={zoomIn}
            disabled={zoom >= MAX_ZOOM}
          >
            <Ionicons name="add" size={24} color={zoom >= MAX_ZOOM ? "#64748B" : "#F8FAFC"} />
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
            onPress={resetZoom}
          >
            <Ionicons name="refresh" size={24} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {/* Controls Overlay */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(11, 15, 20, 0.8)',
          padding: 20,
          paddingBottom: 40,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {mode === 'photo' ? (
              <TouchableOpacity
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#FF7A1A',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4,
                  borderColor: '#F8FAFC',
                }}
                onPress={takePicture}
              >
                <Ionicons name="camera" size={30} color="#0B0F14" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: isRecording ? '#DC2626' : (cameraReady ? '#FF7A1A' : '#64748B'),
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4,
                  borderColor: '#F8FAFC',
                }}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={!cameraReady}
              >
                <Ionicons
                  name={isRecording ? "stop" : "videocam"}
                  size={30}
                  color="#0B0F14"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Enhanced Zoom Indicator */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            alignSelf: 'center',
          }}>
            <Ionicons name="search" size={16} color="#FF7A1A" />
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
              {Math.round((1 + zoom) * 100)}x
            </Text>
            {zoom > 0 && (
              <TouchableOpacity
                style={{
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: 'rgba(255, 122, 26, 0.2)',
                  borderRadius: 10,
                }}
                onPress={resetZoom}
              >
                <Text style={{ color: '#FF7A1A', fontSize: 12, fontWeight: '600' }}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isRecording && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 20,
            }}>
              <View style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#DC2626',
                marginRight: 8,
                shadowColor: '#DC2626',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
              }} />
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
                Recording... {recordingTime}s
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
