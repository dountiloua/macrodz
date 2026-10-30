import '@/lib/i18n';

import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth-store';

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn('Unable to hold the splash screen while fonts load.', error);
});

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const initializeAuth = useAuthStore((state) => state.initialize);
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch((error: unknown) => {
        console.warn('Unable to hide the splash screen after fonts loaded.', error);
      });
    }
  }, [fontsLoaded]);

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
