import React from 'react';
import { View, Text, StyleProp, TextStyle } from 'react-native';
import { BVCard, BVStatChip } from './ui';
import { Project, getMediaByProject } from '../lib/db';
import { formatDate } from '../lib/format';
import { bvColors, bvSpacing, bvTypography } from '../lib/theme/tokens';

type Props = {
  project: Project;
  onPress?: () => void;
  onLongPress?: () => void;
  searchTerm?: string;
};

function HighlightText({
  text,
  term,
  style,
  highlightStyle,
}: {
  text: string;
  term?: string;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
}) {
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
        <Text
          key={idx}
          style={
            p.match
              ? [style, { color: bvColors.brand.accent, fontWeight: '700' }, highlightStyle]
              : undefined
          }
        >
          {p.str}
        </Text>
      ))}
    </Text>
  );
}

export default function ProjectCard({ project, onPress, onLongPress, searchTerm }: Props) {
  const subtitle = [project.client, project.location].filter(Boolean).join(' • ');
  const mediaItems = getMediaByProject(project.id);
  const photoCount = mediaItems.filter((item) => item.type === 'photo').length;
  const videoCount = mediaItems.filter((item) => item.type === 'video').length;
  const noteCount = mediaItems.filter((item) => !!item.note?.trim()).length;
  const lastUpdatedAt = mediaItems[0]?.created_at ?? project.created_at;

  return (
    <BVCard
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ marginBottom: bvSpacing[12] }}
      contentStyle={{ padding: bvSpacing[16] }}
    >
      <HighlightText
        text={project.name}
        term={searchTerm}
        style={{
          ...bvTypography.headingMedium,
          color: bvColors.text.primary,
        }}
      />
      {subtitle.length > 0 && (
        <HighlightText
          text={subtitle}
          term={searchTerm}
          style={{
            ...bvTypography.bodyRegular,
            color: bvColors.text.muted,
            marginTop: bvSpacing[4],
          }}
        />
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: bvSpacing[8],
          marginTop: bvSpacing[12],
        }}
      >
        <BVStatChip icon="image" label={`${photoCount}`} tone="brand" />
        <BVStatChip icon="videocam" label={`${videoCount}`} tone="neutral" />
        <BVStatChip icon="document-text" label={`${noteCount} notes`} tone="success" />
      </View>
      <View style={{ marginTop: bvSpacing[12] }}>
        <Text style={{ ...bvTypography.bodySmall, color: bvColors.text.muted }}>
          Updated {formatDate(lastUpdatedAt)}
        </Text>
      </View>
    </BVCard>
  );
}
