import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { selectionHaptic } from '@/components/ui/haptics';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type OptionCardProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

export function OptionCard({ icon, label, subtitle, selected, onPress, style }: OptionCardProps) {
  function handlePress() {
    selectionHaptic();
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={selected ? colors.text : colors.muted} />
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.radio, selected ? styles.radioSelected : null]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[16],
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  pressed: {
    opacity: 0.86,
  },
  copy: {
    flex: 1,
    gap: spacing[1],
  },
  label: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
    flexShrink: 1,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  radioSelected: {
    borderColor: colors.text,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text,
  },
});
