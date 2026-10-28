import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { syncProfileAndUpdatePending } from '@/features/auth/sync-profile';
import { useAuthStore } from '@/store/auth-store';
import { useProfileStore } from '@/store/profile-store';

export default function DiaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const targets = useProfileStore((state) => state.targets);
  const pendingSync = useProfileStore((state) => state.pendingSync);
  const [isRetrying, setIsRetrying] = useState(false);

  async function retrySync() {
    if (!user || !profile || !targets || isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      const result = await syncProfileAndUpdatePending(profile, targets, user.id);
      if (!result.ok) {
        console.warn('Profile sync retry failed.', result.error);
      }
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('tabs.diary')}</Text>
        {pendingSync ? (
          <View style={styles.syncNotice}>
            <Text accessibilityLiveRegion="polite" style={styles.syncMessage}>
              {t('diary.syncPending')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isRetrying }}
              disabled={isRetrying}
              onPress={() => void retrySync()}
              style={styles.retryTarget}
            >
              <Text style={styles.retryLabel}>
                {isRetrying ? t('diary.syncing') : t('diary.retrySync')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.description}>{t('screens.placeholderDescription')}</Text>

        <View style={styles.actionSection}>
          <PrimaryButton label={t('diary.scanFood')} onPress={() => router.push('/scan')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  syncNotice: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  syncMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#78350f',
  },
  retryTarget: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f766e',
  },
  actionSection: {
    marginTop: 20,
  },
});
