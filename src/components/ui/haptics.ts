import * as Haptics from 'expo-haptics';

export function selectionHaptic() {
  void Haptics.selectionAsync().catch((error: unknown) => {
    console.warn('Selection haptic feedback failed.', error);
  });
}

export function buttonHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error: unknown) => {
    console.warn('Button haptic feedback failed.', error);
  });
}
