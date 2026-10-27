import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MetricRow } from '@/components/metric-row';
import { buttonHaptic } from '@/components/ui/haptics';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';
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

  function handleBack() {
    buttonHaptic();
    router.back();
  }

  return (
    <Screen padding={spacing[4]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t('results.title')}</Text>
          <Text style={styles.subtitle}>{t('results.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <MetricRow label={t('results.bmr')} value={`${plan.bmr} ${kcal}`} dark />
          <MetricRow label={t('results.tdee')} value={`${plan.tdee} ${kcal}`} dark />
          <MetricRow
            label={t('results.calories')}
            value={`${plan.calories} ${kcal}`}
            highlight
            dark
          />
          <MetricRow label={t('results.protein')} value={`${plan.proteinG} ${grams}`} dark />
          <MetricRow label={t('results.carbs')} value={`${plan.carbsG} ${grams}`} dark />
          <MetricRow label={t('results.fat')} value={`${plan.fatG} ${grams}`} dark />
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
        <Button label={t('results.save')} onPress={handleSave} />
        <Button label={t('common.editAnswers')} variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    justifyContent: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[6],
  },
  heading: {
    gap: spacing[2],
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.title,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    lineHeight: 24,
  },
  card: {
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[16],
    backgroundColor: colors.surface,
  },
  warnings: {
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[16],
    backgroundColor: colors.surface,
  },
  warningsTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  warningDot: {
    width: 7,
    height: 7,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  warningText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  footer: {
    gap: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
