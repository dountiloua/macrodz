import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { buttonHaptic } from '@/components/ui/haptics';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type TextFieldProps = Omit<
  TextInputProps,
  'onChangeText' | 'placeholder' | 'secureTextEntry' | 'value'
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  secureTextEntry?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  ...inputProps
}: TextFieldProps) {
  const [secure, setSecure] = useState(secureTextEntry);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secure}
          selectionColor={colors.accent}
          style={styles.input}
          value={value}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: !secure }}
            hitSlop={4}
            onPress={() => {
              buttonHaptic();
              setSecure((current) => !current);
            }}
            style={styles.secureToggle}
          >
            <Ionicons
              name={secure ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  label: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  inputWrap: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: spacing[4],
    color: colors.text,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
  },
  secureToggle: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.error,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
});
