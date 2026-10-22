import { StyleSheet, Text, View } from 'react-native';

type MetricRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

export function MetricRow({ label, value, highlight = false }: MetricRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight ? styles.highlight : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  label: {
    fontSize: 15,
    color: '#475569',
  },
  value: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  highlight: {
    color: '#0f766e',
    fontSize: 19,
  },
});
