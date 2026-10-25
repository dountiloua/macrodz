import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function OnboardingLayout() {
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);

  if (!initialized) {
    return null;
  }

  if (session === null) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    />
  );
}
