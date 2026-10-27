import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { InfoCallout } from '@/components/ui/InfoCallout';
import { OptionCard } from '@/components/ui/OptionCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { buttonHaptic } from '@/components/ui/haptics';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';
import {
  ONBOARDING_LIMITS,
  validateNumericField,
  type Gender,
  type Goal,
  type NumericField,
  type ValidationCode,
  type ValidationResult,
} from '@/features/nutrition-calc';

const STEPS = ['gender', 'age', 'height', 'weight', 'bodyFat', 'trainingDays', 'goal'] as const;

type Step = (typeof STEPS)[number];

const TRAINING_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];

const VALIDATION_KEYS = {
  REQUIRED: 'validation.required',
  INVALID_NUMBER: 'validation.invalidNumber',
  AGE_TOO_LOW: 'validation.ageTooLow',
  AGE_TOO_HIGH: 'validation.ageTooHigh',
  HEIGHT_OUT_OF_RANGE: 'validation.heightOutOfRange',
  WEIGHT_OUT_OF_RANGE: 'validation.weightOutOfRange',
  BODY_FAT_OUT_OF_RANGE: 'validation.bodyFatOutOfRange',
  TRAINING_DAYS_OUT_OF_RANGE: 'validation.trainingDaysOutOfRange',
} as const satisfies Record<ValidationCode, string>;

function numericValue(field: NumericField, raw: string): number | null {
  const result = validateNumericField(field, raw);
  return result.valid ? result.value : null;
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex] ?? 'gender';
  const [transition] = useState(() => new Animated.Value(1));

  const [gender, setGender] = useState<Gender | null>(null);
  const [ageInput, setAgeInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [trainingDays, setTrainingDays] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const ageResult = validateNumericField('age', ageInput);
  const heightResult = validateNumericField('heightCm', heightInput);
  const weightResult = validateNumericField('weightKg', weightInput);
  const bodyFatResult = validateNumericField('bodyFatPercent', bodyFatInput);

  const numericInputs: Partial<
    Record<Step, { field: NumericField; raw: string; result: ValidationResult }>
  > = {
    age: { field: 'age', raw: ageInput, result: ageResult },
    height: { field: 'heightCm', raw: heightInput, result: heightResult },
    weight: { field: 'weightKg', raw: weightInput, result: weightResult },
    bodyFat: { field: 'bodyFatPercent', raw: bodyFatInput, result: bodyFatResult },
  };

  const currentInput = numericInputs[step];
  let errorMessage: string | null = null;

  if (currentInput && currentInput.raw.trim().length > 0 && !currentInput.result.valid) {
    const limits = ONBOARDING_LIMITS[currentInput.field];
    errorMessage = t(VALIDATION_KEYS[currentInput.result.code], {
      min: limits.min,
      max: limits.max,
    });
  }

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [stepIndex, transition]);

  function isStepValid(): boolean {
    switch (step) {
      case 'gender':
        return gender !== null;
      case 'age':
        return ageResult.valid;
      case 'height':
        return heightResult.valid;
      case 'weight':
        return weightResult.valid;
      case 'bodyFat':
        return bodyFatResult.valid;
      case 'trainingDays':
        return trainingDays !== null;
      case 'goal':
        return goal !== null;
    }
  }

  const canContinue = isStepValid();

  function stepContent(): { title: string; subtitle?: string } {
    switch (step) {
      case 'gender':
        return {
          title: t('onboarding.gender.title'),
          subtitle: t('onboarding.gender.subtitle'),
        };
      case 'age':
        return { title: t('onboarding.age.title') };
      case 'height':
        return { title: t('onboarding.height.title') };
      case 'weight':
        return { title: t('onboarding.weight.title') };
      case 'bodyFat':
        return {
          title: t('onboarding.bodyFat.title'),
          subtitle: t('onboarding.bodyFat.subtitle'),
        };
      case 'trainingDays':
        return {
          title: t('onboarding.trainingDays.title'),
          subtitle: t('onboarding.trainingDays.subtitle'),
        };
      case 'goal':
        return { title: t('onboarding.goal.title') };
    }
  }

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function handleBack() {
    buttonHaptic();
    goBack();
  }

  function skipBodyFat() {
    if (step !== 'bodyFat') {
      return;
    }

    setStepIndex((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function goNext() {
    if (!canContinue) {
      return;
    }

    if (stepIndex < STEPS.length - 1) {
      setStepIndex(Math.min(STEPS.length - 1, stepIndex + 1));
      return;
    }

    if (gender === null || goal === null || trainingDays === null) {
      return;
    }

    const age = numericValue('age', ageInput);
    const heightCm = numericValue('heightCm', heightInput);
    const weightKg = numericValue('weightKg', weightInput);
    const bodyFatPercent = numericValue('bodyFatPercent', bodyFatInput);

    if (age === null || heightCm === null || weightKg === null) {
      return;
    }

    router.push({
      pathname: '/onboarding/results',
      params: {
        gender,
        age: String(age),
        heightCm: String(heightCm),
        weightKg: String(weightKg),
        bodyFatPercent: bodyFatPercent === null ? '' : String(bodyFatPercent),
        trainingDaysPerWeek: String(trainingDays),
        goal,
      },
    });
  }

  function renderNumericField(
    field: 'age' | 'height' | 'weight' | 'bodyFat',
    value: string,
    onChangeText: (nextValue: string) => void,
    unit: string,
  ) {
    return (
      <TextField
        label={unit}
        value={value}
        onChangeText={onChangeText}
        placeholder={t(`onboarding.${field}.placeholder`)}
        error={errorMessage}
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="done"
        onSubmitEditing={goNext}
      />
    );
  }

  function renderBody() {
    switch (step) {
      case 'gender':
        return (
          <View style={styles.options}>
            <OptionCard
              icon="male-outline"
              label={t('onboarding.gender.male')}
              selected={gender === 'male'}
              onPress={() => setGender('male')}
            />
            <OptionCard
              icon="female-outline"
              label={t('onboarding.gender.female')}
              selected={gender === 'female'}
              onPress={() => setGender('female')}
            />
          </View>
        );
      case 'age':
        return renderNumericField('age', ageInput, setAgeInput, t('common.units.years'));
      case 'height':
        return renderNumericField('height', heightInput, setHeightInput, t('common.units.cm'));
      case 'weight':
        return renderNumericField('weight', weightInput, setWeightInput, t('common.units.kg'));
      case 'bodyFat':
        return (
          <View style={styles.options}>
            <InfoCallout message={t('onboarding.bodyFat.subtitle')} />
            {renderNumericField(
              'bodyFat',
              bodyFatInput,
              setBodyFatInput,
              t('common.units.percent'),
            )}
            <Button
              label={t('onboarding.bodyFat.skip')}
              variant="secondary"
              onPress={skipBodyFat}
            />
          </View>
        );
      case 'trainingDays':
        return (
          <View style={styles.daysGrid}>
            {TRAINING_DAYS.map((day) => (
              <OptionCard
                key={day}
                icon="barbell-outline"
                label={String(day)}
                selected={trainingDays === day}
                onPress={() => setTrainingDays(day)}
                style={styles.dayCard}
              />
            ))}
          </View>
        );
      case 'goal':
        return (
          <View style={styles.options}>
            <OptionCard
              icon="trending-down-outline"
              label={t('onboarding.goal.cut')}
              subtitle={t('onboarding.goal.cutHint')}
              selected={goal === 'cut'}
              onPress={() => setGoal('cut')}
            />
            <OptionCard
              icon="remove-outline"
              label={t('onboarding.goal.maintain')}
              subtitle={t('onboarding.goal.maintainHint')}
              selected={goal === 'maintain'}
              onPress={() => setGoal('maintain')}
            />
            <OptionCard
              icon="trending-up-outline"
              label={t('onboarding.goal.leanBulk')}
              subtitle={t('onboarding.goal.leanBulkHint')}
              selected={goal === 'lean_bulk'}
              onPress={() => setGoal('lean_bulk')}
            />
          </View>
        );
    }
  }

  const content = stepContent();

  return (
    <Screen padding={spacing[4]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          {stepIndex > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={handleBack}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}
          <View style={styles.progressWrap}>
            <ProgressBar
              current={stepIndex + 1}
              total={STEPS.length}
              label={t('common.stepOf', { current: stepIndex + 1, total: STEPS.length })}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[
              styles.stepContent,
              {
                opacity: transition,
                transform: [
                  {
                    translateY: transition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.heading}>
              <Text style={styles.title}>{content.title}</Text>
              {content.subtitle && step !== 'bodyFat' ? (
                <Text style={styles.subtitle}>{content.subtitle}</Text>
              ) : null}
            </View>
            {renderBody()}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label={t('common.next')} onPress={goNext} disabled={!canContinue} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  progressWrap: {
    flex: 1,
    paddingHorizontal: spacing[2],
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  stepContent: {
    gap: spacing[8],
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
  options: {
    gap: spacing[3],
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  dayCard: {
    flexBasis: '48%',
    minHeight: 64,
    paddingHorizontal: spacing[2],
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
