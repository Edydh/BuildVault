import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { MediaItem } from '@/lib/db';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

type Props = {
  items: MediaItem[];
  onPressItem?: (m: MediaItem) => void;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  showTypeBadge?: boolean;
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

export default function MediaGrid({ items, onPressItem, selected, onToggleSelect, showTypeBadge = true }: Props) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {items.map((m) => {
        const isSel = selected?.has(m.id);
        const displayUri = m.type === 'video' ? m.thumb_uri ?? m.uri : m.uri;
        return (
          <TouchableOpacity
            key={m.id}
            style={{ width: '33.333%', paddingHorizontal: 4, marginBottom: 8 }}
            onPress={() => (onPressItem ? onPressItem(m) : undefined)}
            onLongPress={() => onToggleSelect?.(m.id)}
            activeOpacity={0.9}
          >
            <View style={{ aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' }}>
              {m.type === 'doc' ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,24,38,0.60)' }}>
                  <Ionicons name="document-text" size={36} color="#94A3B8" />
                </View>
              ) : (
                <ExpoImage source={{ uri: displayUri }} contentFit="cover" style={{ flex: 1 }} />
              )}
              {showTypeBadge && <Badge type={m.type} />}
              {onToggleSelect && (
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
                      backgroundColor: isSel ? '#FF7A1A' : 'rgba(16,24,38,0.75)'
                    }]}
                  >
                    {isSel ? (
                      <Ionicons name="checkmark" size={16} color="#0B0F14" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={16} color="#F8FAFC" />
                    )}
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
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

