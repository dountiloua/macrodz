import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LabeledInput } from '@/components/labeled-input';
import { OptionButton } from '@/components/option-button';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
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

type TrainingDayButtonProps = {
  day: number;
  selected: boolean;
  onPress: () => void;
};

function TrainingDayButton({ day, selected, onPress }: TrainingDayButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.day,
        selected ? styles.daySelected : null,
        pressed ? styles.dayPressed : null,
      ]}
    >
      <Text style={[styles.dayLabel, selected ? styles.dayLabelSelected : null]}>{day}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex] ?? 'gender';

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

  if (currentInput && currentInput.raw.trim().length > 0) {
    const result = currentInput.result;

    if (!result.valid) {
      const limits = ONBOARDING_LIMITS[currentInput.field];
      errorMessage = t(VALIDATION_KEYS[result.code], { min: limits.min, max: limits.max });
    }
  }

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

  function renderBody() {
    switch (step) {
      case 'gender':
        return (
          <View style={styles.options}>
            <OptionButton
              label={t('onboarding.gender.male')}
              selected={gender === 'male'}
              onPress={() => setGender('male')}
            />
            <OptionButton
              label={t('onboarding.gender.female')}
              selected={gender === 'female'}
              onPress={() => setGender('female')}
            />
          </View>
        );
      case 'age':
        return (
          <LabeledInput
            value={ageInput}
            onChangeText={setAgeInput}
            placeholder={t('onboarding.age.placeholder')}
            unit={t('common.units.years')}
          />
        );
      case 'height':
        return (
          <LabeledInput
            value={heightInput}
            onChangeText={setHeightInput}
            placeholder={t('onboarding.height.placeholder')}
            unit={t('common.units.cm')}
          />
        );
      case 'weight':
        return (
          <LabeledInput
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder={t('onboarding.weight.placeholder')}
            unit={t('common.units.kg')}
          />
        );
      case 'bodyFat':
        return (
          <View style={styles.options}>
            <LabeledInput
              value={bodyFatInput}
              onChangeText={setBodyFatInput}
              placeholder={t('onboarding.bodyFat.placeholder')}
              unit={t('common.units.percent')}
            />
            <PrimaryButton
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
              <TrainingDayButton
                key={day}
                day={day}
                selected={trainingDays === day}
                onPress={() => setTrainingDays(day)}
              />
            ))}
          </View>
        );
      case 'goal':
        return (
          <View style={styles.options}>
            <OptionButton
              label={t('onboarding.goal.cut')}
              subtitle={t('onboarding.goal.cutHint')}
              selected={goal === 'cut'}
              onPress={() => setGoal('cut')}
            />
            <OptionButton
              label={t('onboarding.goal.maintain')}
              subtitle={t('onboarding.goal.maintainHint')}
              selected={goal === 'maintain'}
              onPress={() => setGoal('maintain')}
            />
            <OptionButton
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          {stepIndex > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={goBack}
              hitSlop={12}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color="#0f172a" />
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
          <View style={styles.heading}>
            <Text style={styles.title}>{content.title}</Text>
            {content.subtitle ? <Text style={styles.subtitle}>{content.subtitle}</Text> : null}
          </View>

          {renderBody()}

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label={t('common.next')} onPress={goNext} disabled={!canContinue} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    flex: 1,
    paddingTop: 8,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 24,
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
  options: {
    gap: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  day: {
    flexBasis: '22%',
    flexGrow: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  dayPressed: {
    opacity: 0.85,
  },
  dayLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayLabelSelected: {
    color: '#0f766e',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f8fafc',
  },
});
