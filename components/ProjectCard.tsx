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
  searchTerm?: string;
};

function HighlightText({ text, term, style, highlightStyle }: { text: string; term?: string; style?: any; highlightStyle?: any }) {
  if (!term) return <Text style={style}>{text}</Text>;
  const q = term.trim().toLowerCase();
  if (!q) return <Text style={style}>{text}</Text>;
  const lower = text.toLowerCase();
  const parts: { str: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push({ str: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ str: text.slice(i, idx), match: false });
    parts.push({ str: text.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }
  return (
    <Text style={style}>
      {parts.map((p, idx) => (
        <Text key={idx} style={p.match ? [style, { color: '#FF7A1A', fontWeight: '700' }, highlightStyle] : undefined}>
          {p.str}
        </Text>
      ))}
    </Text>
  );
}

export default function ProjectCard({ project, onPress, onLongPress, searchTerm }: Props) {
  const subtitle = [project.client, project.location].filter(Boolean).join(' • ');
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={{ marginBottom: 12 }} activeOpacity={0.9}>
      <GlassCard style={{ padding: 16 }}>
        <HighlightText text={project.name} term={searchTerm} style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }} />
        {subtitle.length > 0 && (
          <HighlightText text={subtitle} term={searchTerm} style={{ color: '#94A3B8', marginTop: 4 }} />
        )}
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: '#94A3B8', fontSize: 12 }}>Created {formatDate(project.created_at)}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}
