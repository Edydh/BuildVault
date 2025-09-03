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
    <View className="absolute top-1 left-1 rounded-full bg-[rgba(16,24,38,0.75)] px-1.5 py-1">
      <Ionicons name={icon as any} size={14} color="#F8FAFC" />
    </View>
  );
}

export default function MediaGrid({ items, onPressItem, selected, onToggleSelect, showTypeBadge = true }: Props) {
  return (
    <View className="flex-row flex-wrap -mx-1">
      {items.map((m) => {
        const isSel = selected?.has(m.id);
        const displayUri = m.type === 'video' ? m.thumb_uri ?? m.uri : m.uri;
        return (
          <TouchableOpacity
            key={m.id}
            className="w-1/3 px-1 mb-2"
            onPress={() => (onPressItem ? onPressItem(m) : undefined)}
            onLongPress={() => onToggleSelect?.(m.id)}
            activeOpacity={0.9}
          >
            <View className="aspect-square rounded-xl overflow-hidden border border-border">
              {m.type === 'doc' ? (
                <View className="flex-1 items-center justify-center bg-[rgba(16,24,38,0.60)]">
                  <Ionicons name="document-text" size={36} color="#94A3B8" />
                </View>
              ) : (
                <ExpoImage source={{ uri: displayUri }} contentFit="cover" style={{ flex: 1 }} />
              )}
              {showTypeBadge && <Badge type={m.type} />}
              {onToggleSelect && (
                <View className="absolute bottom-1 right-1">
                  <View
                    className={`w-6 h-6 rounded-full border border-border items-center justify-center ${
                      isSel ? 'bg-primary' : 'bg-[rgba(16,24,38,0.75)]'
                    }`}
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
        <View className="w-full items-center justify-center py-10">
          <Text className="text-text-secondary">No media yet</Text>
        </View>
      )}
    </View>
  );
}

