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
};

export default function ProjectCard({ project, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={{ marginBottom: 12 }} activeOpacity={0.9}>
      <GlassCard style={{ padding: 16 }}>
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>{project.name}</Text>
        {(project.client || project.location) && (
          <Text style={{ color: '#94A3B8', marginTop: 4 }}>
            {[project.client, project.location].filter(Boolean).join(' • ')}
          </Text>
        )}
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: '#94A3B8', fontSize: 12 }}>Created {formatDate(project.created_at)}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

