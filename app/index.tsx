import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/store/auth-store';
import { useProfileStore } from '@/store/profile-store';

export default function Index() {
  const authInitialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const hydrated = useProfileStore((state) => state.hydrated);
  const profile = useProfileStore((state) => state.profile);
  const profileUserId = useProfileStore((state) => state.userId);

  if (!authInitialized || !hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (profileUserId !== session.user.id) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return <Redirect href={profile ? '/diary' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
