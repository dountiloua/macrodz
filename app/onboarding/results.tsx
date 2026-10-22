import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetricRow } from '@/components/metric-row';
import { PrimaryButton } from '@/components/primary-button';
import {
  calculateNutritionPlan,
  validateNumericField,
  type MacroWarning,
  type NumericField,
} from '@/features/nutrition-calc';
import { useProfileStore, type Profile } from '@/store/profile-store';

type ResultsParams = {
  gender?: string;
  age?: string;
  heightCm?: string;
  weightKg?: string;
  bodyFatPercent?: string;
  trainingDaysPerWeek?: string;
  goal?: string;
};

const WARNING_KEYS = {
  PROTEIN_CAPPED: 'warnings.PROTEIN_CAPPED',
  FAT_REDUCED_TO_FLOOR: 'warnings.FAT_REDUCED_TO_FLOOR',
  PROTEIN_REDUCED: 'warnings.PROTEIN_REDUCED',
  CALORIES_RAISED: 'warnings.CALORIES_RAISED',
  CALORIES_RAISED_TO_FLOOR: 'warnings.CALORIES_RAISED_TO_FLOOR',
} as const satisfies Record<MacroWarning, string>;

function parseNumber(field: NumericField, raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }

  const result = validateNumericField(field, raw);
  return result.valid ? result.value : null;
}

function parseProfile(params: ResultsParams): Profile | null {
  const gender = params.gender === 'male' || params.gender === 'female' ? params.gender : null;
  const goal =
    params.goal === 'cut' || params.goal === 'maintain' || params.goal === 'lean_bulk'
      ? params.goal
      : null;
  const age = parseNumber('age', params.age);
  const heightCm = parseNumber('heightCm', params.heightCm);
  const weightKg = parseNumber('weightKg', params.weightKg);
  const trainingDaysPerWeek = parseNumber('trainingDaysPerWeek', params.trainingDaysPerWeek);

  if (
    gender === null ||
    goal === null ||
    age === null ||
    heightCm === null ||
    weightKg === null ||
    trainingDaysPerWeek === null
  ) {
    return null;
  }

  let bodyFatPercent: number | undefined;

  if (params.bodyFatPercent !== undefined && params.bodyFatPercent.length > 0) {
    const parsed = parseNumber('bodyFatPercent', params.bodyFatPercent);

    if (parsed === null) {
      return null;
    }

    bodyFatPercent = parsed;
  }

  return {
    gender,
    goal,
    age,
    heightCm,
    weightKg,
    trainingDaysPerWeek,
    bodyFatPercent,
  };
}

export default function ResultsScreen() {
  const params = useLocalSearchParams<ResultsParams>();
  const { t } = useTranslation();
  const router = useRouter();
  const saveProfile = useProfileStore((state) => state.saveProfile);

  const profile = parseProfile(params);

  if (profile === null) {
    return <Redirect href="/onboarding" />;
  }

  const plan = calculateNutritionPlan(profile);
  const kcal = t('common.units.kcal');
  const grams = t('common.units.g');

  function handleSave() {
    if (profile === null) {
      return;
    }

    saveProfile(profile, plan);
    router.replace('/diary');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t('results.title')}</Text>
          <Text style={styles.subtitle}>{t('results.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <MetricRow label={t('results.bmr')} value={`${plan.bmr} ${kcal}`} />
          <MetricRow label={t('results.tdee')} value={`${plan.tdee} ${kcal}`} />
          <MetricRow label={t('results.calories')} value={`${plan.calories} ${kcal}`} highlight />
          <MetricRow label={t('results.protein')} value={`${plan.proteinG} ${grams}`} />
          <MetricRow label={t('results.carbs')} value={`${plan.carbsG} ${grams}`} />
          <MetricRow label={t('results.fat')} value={`${plan.fatG} ${grams}`} />
        </View>

        {plan.warnings.length > 0 ? (
          <View style={styles.warnings}>
            <Text style={styles.warningsTitle}>{t('results.warningsTitle')}</Text>
            {plan.warnings.map((warning) => (
              <View key={warning} style={styles.warningRow}>
                <View style={styles.warningDot} />
                <Text style={styles.warningText}>{t(WARNING_KEYS[warning])}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={t('results.save')} onPress={handleSave} />
        <PrimaryButton
          label={t('common.editAnswers')}
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 20,
  },
  heading: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
  },
  warnings: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 16,
    gap: 10,
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningRow: {
    flexDirection: 'row',
    gap: 10,
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d97706',
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#78350f',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: '#f8fafc',
  },
});
