import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/store/auth-store';
import { useProfileStore } from '@/store/profile-store';

type TabBarIconProps = {
  name: ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  size: number;
};

function TabBarIcon({ name, color, size }: TabBarIconProps) {
  return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const authInitialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const hydrated = useProfileStore((state) => state.hydrated);
  const profile = useProfileStore((state) => state.profile);

  if (!authInitialized || !hydrated) {
    return null;
  }

  if (session === null) {
    return <Redirect href="/login" />;
  }

  if (profile === null) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0f766e' }}>
      <Tabs.Screen
        name="diary"
        options={{
          title: t('tabs.diary'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="restaurant-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: t('tabs.workouts'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="barbell-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="trending-up-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
