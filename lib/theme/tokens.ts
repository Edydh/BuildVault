export const bvColors = {
  brand: {
    primary: '#1C3F94',
    primaryLight: '#3A63F3',
    accent: '#FF7A1A',
  },
  neutral: {
    900: '#0F172A',
    700: '#334155',
    600: '#475569',
    500: '#64748B',
    400: '#94A3B8',
    200: '#CBD5E1',
    100: '#F1F5F9',
    0: '#FFFFFF',
  },
  surface: {
    app: '#0F172A',
    inverse: '#0B0F14',
    chrome: '#101826',
    muted: '#1F2A37',
    card: '#334155',
    cardElevated: '#3E4A5E',
    glass: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.14)',
    overlay: 'rgba(15,23,42,0.72)',
    shadow: '#000000',
  },
  semantic: {
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    dangerStrong: '#EF4444',
    dangerTint: '#FCA5A5',
    info: '#3A63F3',
  },
  interactive: {
    selected: '#3B82F6',
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    muted: '#94A3B8',
    tertiary: '#64748B',
    onPrimary: '#F1F5F9',
    inverse: '#0F172A',
  },
} as const;

export const bvFx = {
  brandSoft: 'rgba(58,99,243,0.20)',
  brandSoftStrong: 'rgba(58,99,243,0.24)',
  brandBorder: 'rgba(58,99,243,0.35)',
  accentSoft: 'rgba(255,122,26,0.20)',
  accentSoftStrong: 'rgba(255,122,26,0.90)',
  accentTint: 'rgba(255,122,26,0.10)',
  accentHint: 'rgba(255,122,26,0.05)',
  accentBorder: 'rgba(255,122,26,0.35)',
  accentBorderSoft: 'rgba(255,122,26,0.20)',
  dangerTint: 'rgba(239,68,68,0.10)',
  dangerBorder: 'rgba(239,68,68,0.30)',
  glassSoft: 'rgba(255,255,255,0.05)',
  glassBorderSoft: 'rgba(255,255,255,0.10)',
  neutralBorder: 'rgba(148,163,184,0.25)',
  neutralBorderSoft: 'rgba(148,163,184,0.35)',
  blackTint10: 'rgba(0,0,0,0.10)',
  blackTint20: 'rgba(0,0,0,0.20)',
  blackTint25: 'rgba(0,0,0,0.25)',
  blackTint60: 'rgba(0,0,0,0.60)',
  blackTint70: 'rgba(0,0,0,0.70)',
  blackTint80: 'rgba(0,0,0,0.80)',
  appOverlay: 'rgba(11,15,20,0.70)',
  selectionSoft: 'rgba(59,130,246,0.20)',
} as const;

export const bvSpacing = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
} as const;

export const bvRadius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

export const bvBlur = {
  glass: 20,
  navigation: 30,
} as const;

export const bvTypography = {
  headingLarge: {
    fontFamily: 'DM Sans',
    fontWeight: '700' as const,
    fontSize: 22,
    lineHeight: 28,
  },
  headingMedium: {
    fontFamily: 'DM Sans',
    fontWeight: '600' as const,
    fontSize: 18,
    lineHeight: 24,
  },
  bodyRegular: {
    fontFamily: 'DM Sans',
    fontWeight: '400' as const,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: 'DM Sans',
    fontWeight: '400' as const,
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontFamily: 'DM Sans',
    fontWeight: '500' as const,
    fontSize: 13,
    lineHeight: 18,
  },
} as const;

export type BVStatusTone = 'active' | 'delayed' | 'completed' | 'neutral';

export const bvStatusColors: Record<BVStatusTone, string> = {
  active: bvColors.semantic.success,
  delayed: bvColors.semantic.warning,
  completed: bvColors.brand.primaryLight,
  neutral: bvColors.neutral[400],
};
