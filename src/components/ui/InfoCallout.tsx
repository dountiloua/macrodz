import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type InfoCalloutProps = {
  message: string;
};

export function InfoCallout({ message }: InfoCalloutProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="information-circle-outline" size={20} color={colors.muted} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  message: {
    flex: 1,
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
    lineHeight: 19,
  },
});
