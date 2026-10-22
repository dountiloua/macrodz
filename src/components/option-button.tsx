import { Pressable, StyleSheet, Text } from 'react-native';

type OptionButtonProps = {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
};

export function OptionButton({ label, subtitle, selected, onPress }: OptionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{label}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 4,
  },
  selected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  selectedLabel: {
    color: '#0f766e',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
});
