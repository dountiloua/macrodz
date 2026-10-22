import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetricRow } from '@/components/metric-row';
import { PrimaryButton } from '@/components/primary-button';
import { useProfileStore } from '@/store/profile-store';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const targets = useProfileStore((state) => state.targets);

  if (targets === null) {
    return null;
  }

  const kcal = t('common.units.kcal');
  const grams = t('common.units.g');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('tabs.profile')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.targetsTitle')}</Text>
          <View style={styles.card}>
            <MetricRow label={t('profile.bmr')} value={`${targets.bmr} ${kcal}`} />
            <MetricRow label={t('profile.tdee')} value={`${targets.tdee} ${kcal}`} />
            <MetricRow
              label={t('profile.calories')}
              value={`${targets.calories} ${kcal}`}
              highlight
            />
            <MetricRow label={t('profile.protein')} value={`${targets.proteinG} ${grams}`} />
            <MetricRow label={t('profile.carbs')} value={`${targets.carbsG} ${grams}`} />
            <MetricRow label={t('profile.fat')} value={`${targets.fatG} ${grams}`} />
          </View>
        </View>

        <PrimaryButton
          label={t('profile.redo')}
          variant="secondary"
          onPress={() => router.push('/onboarding')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
  },
});
