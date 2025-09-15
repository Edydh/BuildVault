import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassCard } from './glass';
import { Project } from '../lib/db';
import { formatDate } from '../lib/format';

type Props = {
  project: Project;
  onPress?: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
};

export default function ProjectCard({ project, onPress, onLongPress, onEdit }: Props) {
  const handleEditPress = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit?.();
  };

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={{ marginBottom: 12 }} activeOpacity={0.9}>
      <GlassCard style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>{project.name}</Text>
            {(project.client || project.location) && (
              <Text style={{ color: '#94A3B8', marginTop: 4 }}>
                {[project.client, project.location].filter(Boolean).join(' • ')}
              </Text>
            )}
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>Created {formatDate(project.created_at)}</Text>
            </View>
          </View>
          
          {/* Edit Button */}
          <TouchableOpacity
            onPress={handleEditPress}
            style={{
              backgroundColor: 'rgba(100, 116, 139, 0.2)',
              borderRadius: 8,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

