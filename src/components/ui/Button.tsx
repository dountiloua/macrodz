import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { buttonHaptic } from '@/components/ui/haptics';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary';
};

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  variant = 'primary',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  function handlePress() {
    if (isDisabled) {
      return;
    }

    buttonHaptic();
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator color={variant === 'primary' ? colors.text : colors.muted} />
          {loadingLabel ? <Text style={styles.label}>{loadingLabel}</Text> : null}
        </View>
      ) : (
        <Text style={[styles.label, variant === 'secondary' ? styles.secondaryLabel : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    borderRadius: radii[16],
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
    textAlign: 'center',
  },
  secondaryLabel: {
    color: colors.text,
  },
  loadingContent: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
});
