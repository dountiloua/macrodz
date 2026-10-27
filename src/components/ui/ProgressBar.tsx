import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type ProgressBarProps = {
  current: number;
  total: number;
  label?: string;
};

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const progress = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: current }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  label: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  track: {
    height: 4,
    overflow: 'hidden',
    borderRadius: radii[12],
    backgroundColor: colors.border,
  },
  fill: {
    height: '100%',
    borderRadius: radii[12],
    backgroundColor: colors.accent,
  },
});
