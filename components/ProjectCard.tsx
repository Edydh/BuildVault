import React from 'react';
import { View, Text, StyleProp, TextStyle } from 'react-native';
import { BVCard, BVStatChip } from './ui';
import { Project, ProjectStatus, getMediaByProject } from '../lib/db';
import { formatDate } from '../lib/format';
import {
  bvColors,
  bvFx,
  bvRadius,
  bvSpacing,
  bvStatusColors,
  bvTypography,
} from '../lib/theme/tokens';

type Props = {
  project: Project;
  onPress?: () => void;
  onLongPress?: () => void;
  searchTerm?: string;
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  delayed: 'Delayed',
  completed: 'Completed',
  neutral: 'No Activity',
};

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const normalized = cleanHex.length === 3
    ? cleanHex.split('').map((ch) => `${ch}${ch}`).join('')
    : cleanHex;

  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatShortDate(ms?: number | null): string {
  if (!ms) return 'TBD';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBudget(amount?: number | null): string {
  if (!amount || amount <= 0) return '—';
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

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
  const lastUpdatedAt = project.updated_at || mediaItems[0]?.created_at || project.created_at;

  const status = project.status || 'neutral';
  const statusColor = bvStatusColors[status];
  const progress = Math.max(0, Math.min(100, Math.round(project.progress ?? 0)));

  const metrics = [
    {
      id: 'start',
      label: 'Start Date',
      value: formatShortDate(project.start_date || project.created_at),
    },
    {
      id: 'end',
      label: 'End Date',
      value: formatShortDate(project.end_date),
    },
    {
      id: 'budget',
      label: 'Budget',
      value: formatBudget(project.budget),
    },
    {
      id: 'progress',
      label: 'Progress',
      value: `${progress}%`,
    },
  ];

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
          marginTop: bvSpacing[12],
          paddingTop: bvSpacing[12],
          borderTopWidth: 1,
          borderTopColor: bvFx.neutralBorder,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ ...bvTypography.label, color: bvColors.text.muted }}>Status</Text>
          <View
            style={{
              paddingHorizontal: bvSpacing[12],
              paddingVertical: bvSpacing[4],
              borderRadius: bvRadius.pill,
              backgroundColor: hexToRgba(statusColor, 0.18),
              borderWidth: 1,
              borderColor: hexToRgba(statusColor, 0.35),
            }}
          >
            <Text style={{ ...bvTypography.label, color: statusColor }}>{STATUS_LABELS[status]}</Text>
          </View>
        </View>

        <View
          style={{
            marginTop: bvSpacing[8],
            height: 8,
            borderRadius: bvRadius.pill,
            backgroundColor: bvColors.neutral[200],
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: bvRadius.pill,
              backgroundColor: bvColors.brand.primaryLight,
            }}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          marginTop: bvSpacing[12],
        }}
      >
        {metrics.map((metric) => (
          <View key={metric.id} style={{ width: '48%', marginBottom: bvSpacing[8] }}>
            <Text style={{ ...bvTypography.bodySmall, color: bvColors.text.tertiary }}>{metric.label}</Text>
            <Text style={{ ...bvTypography.bodyRegular, color: bvColors.text.primary, fontWeight: '600' }}>
              {metric.value}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: bvSpacing[8],
          marginTop: bvSpacing[4],
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
