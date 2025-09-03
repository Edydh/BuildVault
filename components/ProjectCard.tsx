import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import GlassCard from './GlassCard';
import { Project } from '@/lib/db';
import { formatDate } from '@/lib/format';

type Props = {
  project: Project;
  onPress?: () => void;
  onLongPress?: () => void;
};

export default function ProjectCard({ project, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} className="mb-3" activeOpacity={0.9}>
      <GlassCard className="p-4 bg-[rgba(16,24,38,0.60)] border border-border">
        <Text className="text-text-primary text-lg font-semibold">{project.name}</Text>
        {(project.client || project.location) && (
          <Text className="text-text-secondary mt-1">
            {[project.client, project.location].filter(Boolean).join(' • ')}
          </Text>
        )}
        <View className="mt-2">
          <Text className="text-text-secondary text-xs">Created {formatDate(project.created_at)}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

