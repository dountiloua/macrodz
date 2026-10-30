import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useWorkoutMutations, useWorkouts } from '@/features/workouts';
import { isValidWorkoutDate } from '@/features/workouts/validation';
import { getWorkoutVolume } from '@/features/workouts/volume';
import { useAuthStore } from '@/store/auth-store';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayWorkoutDate(value: string, language: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12));
}

export default function WorkoutsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const workoutsQuery = useWorkouts(user?.id);
  const mutations = useWorkoutMutations(user?.id ?? '');
  const workouts = workoutsQuery.data ?? [];
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(() => localDateString(new Date()));
  const [workoutName, setWorkoutName] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const language = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const mostRecentWorkout = workouts[0];

  async function saveWorkout() {
    if (
      !user ||
      !isValidWorkoutDate(workoutDate.trim()) ||
      workoutName.trim().length === 0 ||
      workoutName.trim().length > 80 ||
      workoutNotes.trim().length > 500
    ) {
      setInputError(t('workouts.invalidWorkout'));
      return;
    }

    setInputError(null);
    setFormError(null);
    try {
      await mutations.create.mutateAsync({
        workout_date: workoutDate.trim(),
        name: workoutName,
        notes: workoutNotes,
      });
      setWorkoutName('');
      setWorkoutNotes('');
      setShowWorkoutForm(false);
    } catch {
      setFormError(t('workouts.saveError'));
    }
  }

  async function copyLastWorkout() {
    if (!mostRecentWorkout) return;
    setFormError(null);
    try {
      const copied = await mutations.copy.mutateAsync({
        source: mostRecentWorkout,
        workoutDate: localDateString(new Date()),
      });
      router.push({ pathname: '/workouts/[id]', params: { id: copied.id } });
    } catch {
      setFormError(t('workouts.copyError'));
    }
  }

  return (
    <Screen padding={0} style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={workoutsQuery.isRefetching}
            onRefresh={() => void workoutsQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.title}>{t('tabs.workouts')}</Text>
        <Text style={styles.subtitle}>{t('workouts.subtitle')}</Text>

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}

        {showWorkoutForm ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>{t('workouts.newWorkout')}</Text>
            <TextField
              label={t('workouts.date')}
              value={workoutDate}
              onChangeText={setWorkoutDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <TextField
              label={t('workouts.name')}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholder={t('workouts.namePlaceholder')}
              maxLength={80}
            />
            <TextField
              label={t('workouts.notes')}
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              placeholder={t('workouts.notesPlaceholder')}
              maxLength={500}
              multiline
              textAlignVertical="top"
            />
            <Button
              label={t('workouts.create')}
              loading={mutations.create.isPending}
              onPress={() => void saveWorkout()}
            />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => {
                setShowWorkoutForm(false);
                setInputError(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label={t('workouts.newWorkout')}
              onPress={() => {
                setInputError(null);
                setFormError(null);
                setShowWorkoutForm(true);
              }}
            />
            <Button
              label={t('workouts.copyLastWorkout')}
              variant="secondary"
              disabled={!mostRecentWorkout || mutations.copy.isPending}
              loading={mutations.copy.isPending}
              onPress={() => void copyLastWorkout()}
            />
          </View>
        )}

        {workoutsQuery.isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : workoutsQuery.isError ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('workouts.loadError')}</Text>
            <Button
              label={t('workouts.retry')}
              variant="secondary"
              onPress={() => void workoutsQuery.refetch()}
            />
          </View>
        ) : workouts.length === 0 ? (
          <Text style={styles.emptyText}>{t('workouts.empty')}</Text>
        ) : (
          workouts.map((workout) => (
            <Pressable
              key={workout.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/workouts/[id]', params: { id: workout.id } })
              }
              style={({ pressed }) => [styles.workoutCard, pressed ? styles.pressed : null]}
            >
              <View style={styles.workoutCopy}>
                <Text style={styles.workoutName}>{workout.name}</Text>
                <Text style={styles.workoutDate}>
                  {displayWorkoutDate(workout.workout_date, language)}
                </Text>
                <Text style={styles.workoutStats}>
                  {t('workouts.historySummary', {
                    exercises: new Set(
                      workout.workout_sets.map((set) => set.exercise.toLowerCase()),
                    ).size,
                    sets: workout.workout_sets.length,
                  })}
                </Text>
              </View>
              <View style={styles.volumeGroup}>
                <Text style={styles.volumeValue}>
                  {getWorkoutVolume(workout.workout_sets).toLocaleString(language, {
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text style={styles.volumeLabel}>{t('workouts.volumeKg')}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
  actions: { gap: spacing[2] },
  formCard: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  cardTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },
  workoutCopy: { flex: 1, gap: spacing[1] },
  workoutName: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  workoutDate: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  workoutStats: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  volumeGroup: { alignItems: 'flex-end', gap: spacing[1] },
  volumeValue: { color: colors.accent, fontFamily: fontFamilies.bold, fontSize: typography.body },
  volumeLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  stateBox: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errorText: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.body },
  emptyText: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
});
