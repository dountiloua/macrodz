export const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  border: '#333333',
  text: '#FFFFFF',
  muted: '#A3A3A3',
  accent: '#0F766E',
  accentSurface: '#173B39',
  error: '#F87171',
  success: '#4ADE80',
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

export const radii = {
  12: 12,
  16: 16,
  24: 24,
} as const;

export const typography = {
  title: 28,
  heading: 20,
  body: 16,
  caption: 13,
} as const;

export const fontFamilies = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
} as const;
