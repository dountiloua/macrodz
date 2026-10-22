import { StyleSheet, Text, TextInput, View } from 'react-native';

type LabeledInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  unit: string;
  onSubmitEditing?: () => void;
};

export function LabeledInput({
  value,
  onChangeText,
  placeholder,
  unit,
  onSubmitEditing,
}: LabeledInputProps) {
  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        style={styles.input}
        selectionColor="#0f766e"
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    height: 60,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  unit: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
  },
});
