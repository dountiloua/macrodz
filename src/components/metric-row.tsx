import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies } from '@/theme/tokens';

type MetricRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
  dark?: boolean;
};

export function MetricRow({ label, value, highlight = false, dark = false }: MetricRowProps) {
  return (
    <View style={[styles.row, dark ? styles.darkRow : null]}>
      <Text style={[styles.label, dark ? styles.darkLabel : null]}>{label}</Text>
      <Text
        style={[styles.value, dark ? styles.darkValue : null, highlight ? styles.highlight : null]}
      >
        {value}
      </Text>
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
    color: '#ffffff',
    fontSize: 19,
  },
  darkRow: {
    borderBottomColor: colors.border,
  },
  darkLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
  },
  darkValue: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
  },
});
