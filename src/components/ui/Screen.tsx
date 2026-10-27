import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  edges?: Edge[];
  padding?: number;
  style?: ViewStyle;
}>;

export function Screen({ children, edges, padding = spacing[6], style }: ScreenProps) {
  return (
    <SafeAreaView edges={edges ?? ['top', 'bottom']} style={styles.safeArea}>
      <View style={[styles.content, { padding }, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
