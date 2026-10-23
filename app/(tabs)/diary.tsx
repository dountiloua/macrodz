import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';

export default function DiaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('tabs.diary')}</Text>
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
  actionSection: {
    marginTop: 20,
  },
});
