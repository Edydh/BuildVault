import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { MediaItem, updateMediaNote } from '@/lib/db';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import LazyImage from './LazyImage';
import { ImageVariants, getImageVariants, checkImageVariantsExist, generateImageVariants } from '@/lib/imageOptimization';
import NoteEncouragement from './NoteEncouragement';

type Props = {
  items: MediaItem[];
  onPressItem?: (m: MediaItem) => void;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  showTypeBadge?: boolean;
  projectId: string;
};

function Badge({ type }: { type: MediaItem['type'] }) {
  const icon = type === 'photo' ? 'image' : type === 'video' ? 'videocam' : 'document';
  return (
    <View style={{
      position: 'absolute',
      top: 4,
      left: 4,
      borderRadius: 12,
      backgroundColor: 'rgba(16,24,38,0.75)',
      paddingHorizontal: 6,
      paddingVertical: 4,
    }}>
      <Ionicons name={icon as any} size={14} color="#F8FAFC" />
    </View>
  );
}

function MediaItemComponent({ 
  item, 
  onPress, 
  onLongPress, 
  isSelected, 
  showTypeBadge, 
  projectId 
}: { 
  item: MediaItem; 
  onPress?: () => void; 
  onLongPress?: () => void; 
  isSelected: boolean; 
  showTypeBadge: boolean;
  projectId: string;
}) {
  const [variants, setVariants] = useState<ImageVariants | null>(null);

  const handleNoteSave = (note: string) => {
    try {
      updateMediaNote(item.id, note);
      // Note: We don't update local state here as the parent will re-render
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleNoteUpdate = (note: string) => {
    try {
      updateMediaNote(item.id, note);
      // Note: We don't update local state here as the parent will re-render
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  useEffect(() => {
    const loadVariants = async () => {
      if (item.type !== 'photo') return;

      try {
        // Check if variants already exist
        const variantsExist = await checkImageVariantsExist(item.id, projectId);
        
        if (variantsExist) {
          // Load existing variants
          const existingVariants = await getImageVariants(item.id, projectId, item.uri);
          setVariants(existingVariants);
        } else {
          // Generate new variants in the background
          setIsGeneratingVariants(true);
          const newVariants = await generateImageVariants(item.uri, projectId, item.id);
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
  }, [item.id, item.uri, item.type, projectId]);

  const displayUri = item.type === 'video' ? item.thumb_uri ?? item.uri : item.uri;
  
  // Debug logging for video thumbnails
  if (item.type === 'video') {
    console.log('Video item display URI:', {
      id: item.id,
      thumb_uri: item.thumb_uri,
      uri: item.uri,
      displayUri: displayUri,
      type: item.type
    });
  }

  return (
    <TouchableOpacity
      style={{ width: '33.333%', paddingHorizontal: 4, marginBottom: 8 }}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      <View style={{ aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' }}>
        {item.type === 'doc' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,24,38,0.60)' }}>
            <Ionicons name="document-text" size={36} color="#94A3B8" />
          </View>
        ) : item.type === 'photo' && variants ? (
          <LazyImage
            variants={variants}
            style={{ flex: 1 }}
            contentFit="cover"
            progressiveLoading={true}
            priority="normal"
          />
        ) : item.type === 'video' ? (
          <View style={{ flex: 1, position: 'relative' }}>
            <ExpoImage 
              source={{ uri: displayUri }} 
              contentFit="cover" 
              style={{ flex: 1 }} 
              onError={(error) => {
                console.log('Video thumbnail load error:', error);
                console.log('Failed URI:', displayUri);
              }}
              onLoad={() => {
                console.log('Video thumbnail loaded successfully:', displayUri);
              }}
            />
            {/* Video play overlay */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 122, 26, 0.9)',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Ionicons name="play" size={20} color="#FFFFFF" />
              </View>
            </View>
          </View>
        ) : (
          <ExpoImage 
            source={{ uri: displayUri }} 
            contentFit="cover" 
            style={{ flex: 1 }} 
          />
        )}
        
        {showTypeBadge && <Badge type={item.type} />}
        
        {isGeneratingVariants && (
          <View style={{
            position: 'absolute',
            top: 4,
            right: 4,
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
        
        {onLongPress && (
          <View style={{ position: 'absolute', bottom: 4, right: 4 }}>
            <View
              style={[{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#1E293B',
                alignItems: 'center',
                justifyContent: 'center',
              }, {
                backgroundColor: isSelected ? '#FF7A1A' : 'rgba(16,24,38,0.75)'
              }]}
            >
              {isSelected ? (
                <Ionicons name="checkmark" size={16} color="#0B0F14" />
              ) : (
                <Ionicons name="ellipse-outline" size={16} color="#F8FAFC" />
              )}
            </View>
          </View>
        )}
        
        {/* Note Encouragement */}
        <NoteEncouragement
          mediaId={item.id}
          hasNote={!!item.note}
          currentNote={item.note || ''}
          onNoteSave={handleNoteSave}
          onNoteUpdate={handleNoteUpdate}
          mediaType={item.type}
          showPrompt={!item.note}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function MediaGrid({ items, onPressItem, selected, onToggleSelect, showTypeBadge = true, projectId }: Props) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {items.map((m) => {
        const isSel = selected?.has(m.id);
        return (
          <MediaItemComponent
            key={m.id}
            item={m}
            onPress={() => onPressItem?.(m)}
            onLongPress={() => onToggleSelect?.(m.id)}
            isSelected={isSel || false}
            showTypeBadge={showTypeBadge || false}
            projectId={projectId}
          />
        );
      })}
      {items.length === 0 && (
        <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
          <Text style={{ color: '#94A3B8' }}>No media yet</Text>
        </View>
      )}
    </View>
  );
}

