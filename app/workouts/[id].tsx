import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useWorkoutMutations, useWorkouts } from '@/features/workouts';
import {
  isValidWorkoutSetEditValues,
  isValidWorkoutSetValues,
} from '@/features/workouts/validation';
import { getWorkoutVolume, groupWorkoutSets } from '@/features/workouts/volume';
import type { WorkoutSet } from '@/features/workouts/types';
import { useAuthStore } from '@/store/auth-store';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

function displayWorkoutDate(value: string, language: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12));
}

export default function WorkoutDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;
  const user = useAuthStore((state) => state.user);
  const query = useWorkouts(user?.id);
  const mutations = useWorkoutMutations(user?.id ?? '');
  const workout = query.data?.find((item) => item.id === workoutId);
  const language = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const [showAddForm, setShowAddForm] = useState(false);
  const [exercise, setExercise] = useState('');
  const [setNumber, setSetNumber] = useState('1');
  const [reps, setReps] = useState('8');
  const [weightKg, setWeightKg] = useState('0');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editExercise, setEditExercise] = useState('');
  const [editSetNumber, setEditSetNumber] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editWeightKg, setEditWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const exerciseSuggestions = useMemo(() => {
    const search = exercise.trim().toLocaleLowerCase();
    const unique = new Map<string, string>();
    for (const pastWorkout of query.data ?? []) {
      for (const set of pastWorkout.workout_sets) {
        const key = set.exercise.trim().toLocaleLowerCase();
        if (!unique.has(key)) unique.set(key, set.exercise);
      }
    }
    return [...unique.values()]
      .filter((name) => search.length > 0 && name.toLocaleLowerCase().includes(search))
      .slice(0, 5);
  }, [exercise, query.data]);

  function confirmDeleteSet(set: WorkoutSet) {
    if (!workout) return;
    Alert.alert(
      t('workouts.deleteSetTitle'),
      t('workouts.deleteSetConfirm', { exercise: set.exercise, setNumber: set.set_number }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workouts.delete'),
          style: 'destructive',
          onPress: () => {
            setError(null);
            void mutations.removeSet
              .mutateAsync({ workoutId: workout.id, setId: set.id })
              .catch(() => setError(t('workouts.saveError')));
          },
        },
      ],
    );
  }

  function confirmDeleteWorkout() {
    if (!workout) return;
    Alert.alert(t('workouts.deleteWorkoutTitle'), t('workouts.deleteWorkoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('workouts.delete'),
        style: 'destructive',
        onPress: () => {
          setError(null);
          void mutations.removeWorkout
            .mutateAsync(workout.id)
            .then(() => router.back())
            .catch(() => setError(t('workouts.saveError')));
        },
      },
    ]);
  }

  async function saveNewSet() {
    if (!workout || !user) return;
    const values = {
      workout_id: workout.id,
      user_id: user.id,
      exercise,
      set_number: Number(setNumber),
      reps: Number(reps),
      weight_kg: Number(weightKg),
    };
    if (!isValidWorkoutSetValues(values)) {
      setError(t('workouts.invalidSet'));
      return;
    }

    setError(null);
    try {
      await mutations.addSet.mutateAsync({
        workout_id: values.workout_id,
        exercise: values.exercise.trim(),
        set_number: values.set_number,
        reps: values.reps,
        weight_kg: values.weight_kg,
      });
      setExercise('');
      setSetNumber('1');
      setReps('8');
      setWeightKg('0');
      setShowAddForm(false);
    } catch {
      setError(t('workouts.saveError'));
    }
  }

  function startEditing(set: WorkoutSet) {
    setEditingSetId(set.id);
    setEditExercise(set.exercise);
    setEditSetNumber(String(set.set_number));
    setEditReps(String(set.reps));
    setEditWeightKg(String(set.weight_kg));
    setError(null);
  }

  async function saveEditedSet(set: WorkoutSet) {
    if (!workout) return;
    const values = {
      exercise: editExercise,
      set_number: Number(editSetNumber),
      reps: Number(editReps),
      weight_kg: Number(editWeightKg),
    };
    if (!isValidWorkoutSetEditValues(values)) {
      setError(t('workouts.invalidSet'));
      return;
    }
    setError(null);
    try {
      await mutations.editSet.mutateAsync({
        workoutId: workout.id,
        setId: set.id,
        values,
      });
      setEditingSetId(null);
    } catch {
      setError(t('workouts.saveError'));
    }
  }

  if (query.isLoading) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !workout) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>
            {query.isError ? t('workouts.loadError') : t('workouts.notFound')}
          </Text>
          <Button
            label={t('workouts.backToHistory')}
            variant="secondary"
            onPress={() => router.back()}
          />
          {query.isError ? (
            <Button label={t('workouts.retry')} onPress={() => void query.refetch()} />
          ) : null}
        </View>
      </Screen>
    );
  }

  const exerciseGroups = groupWorkoutSets(workout.workout_sets);

  return (
    <Screen padding={0} style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Text style={styles.backText}>{t('workouts.backToHistory')}</Text>
        </Pressable>

        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>{workout.name}</Text>
            <Text style={styles.subtitle}>
              {displayWorkoutDate(workout.workout_date, language)}
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
        </View>

        {workout.notes ? <Text style={styles.notes}>{workout.notes}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {exerciseGroups.length === 0 ? (
          <Text style={styles.emptyText}>{t('workouts.noSets')}</Text>
        ) : (
          exerciseGroups.map((group) => (
            <View key={group.exercise} style={styles.exerciseCard}>
              <View style={styles.exerciseHeading}>
                <Text style={styles.exerciseName}>{group.exercise}</Text>
                <Text style={styles.exerciseVolume}>
                  {group.volumeKg.toLocaleString(language, { maximumFractionDigits: 2 })}{' '}
                  {t('workouts.volumeKg')}
                </Text>
              </View>
              {group.sets.map((set) => (
                <View key={set.id} style={styles.setRow}>
                  {editingSetId === set.id ? (
                    <View style={styles.editForm}>
                      <TextField
                        label={t('workouts.exercise')}
                        value={editExercise}
                        onChangeText={setEditExercise}
                        maxLength={80}
                      />
                      <View style={styles.numberFields}>
                        <View style={styles.numberField}>
                          <TextField
                            label={t('workouts.setNumber')}
                            value={editSetNumber}
                            onChangeText={setEditSetNumber}
                            keyboardType="number-pad"
                          />
                        </View>
                        <View style={styles.numberField}>
                          <TextField
                            label={t('workouts.reps')}
                            value={editReps}
                            onChangeText={setEditReps}
                            keyboardType="number-pad"
                          />
                        </View>
                        <View style={styles.numberField}>
                          <TextField
                            label={t('workouts.weightKg')}
                            value={editWeightKg}
                            onChangeText={setEditWeightKg}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                      <Button
                        label={t('common.save')}
                        loading={mutations.editSet.isPending}
                        onPress={() => void saveEditedSet(set)}
                      />
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        onPress={() => setEditingSetId(null)}
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.setText}>
                        {t('workouts.setSummary', {
                          setNumber: set.set_number,
                          reps: set.reps,
                          weight: set.weight_kg,
                        })}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('workouts.editSet')}
                        onPress={() => startEditing(set)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="create-outline" size={20} color={colors.accent} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('workouts.deleteSet')}
                        onPress={() => confirmDeleteSet(set)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                      </Pressable>
                    </>
                  )}
                </View>
              ))}
            </View>
          ))
        )}

        {showAddForm ? (
          <View style={styles.addForm}>
            <Text style={styles.sectionTitle}>{t('workouts.addSet')}</Text>
            <TextField
              label={t('workouts.exercise')}
              value={exercise}
              onChangeText={setExercise}
              placeholder={t('workouts.exercisePlaceholder')}
              maxLength={80}
            />
            {exerciseSuggestions.length ? (
              <View style={styles.suggestions}>
                {exerciseSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    onPress={() => {
                      setExercise(suggestion);
                      const nextNumber =
                        Math.max(
                          0,
                          ...workout.workout_sets
                            .filter(
                              (set) =>
                                set.exercise.toLocaleLowerCase() === suggestion.toLocaleLowerCase(),
                            )
                            .map((set) => set.set_number),
                        ) + 1;
                      setSetNumber(String(nextNumber));
                    }}
                    style={styles.suggestion}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.numberFields}>
              <View style={styles.numberField}>
                <TextField
                  label={t('workouts.setNumber')}
                  value={setNumber}
                  onChangeText={setSetNumber}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.numberField}>
                <TextField
                  label={t('workouts.reps')}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.numberField}>
                <TextField
                  label={t('workouts.weightKg')}
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Button
              label={t('workouts.saveSet')}
              loading={mutations.addSet.isPending}
              onPress={() => void saveNewSet()}
            />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setShowAddForm(false)}
            />
          </View>
        ) : (
          <Button label={t('workouts.addSet')} onPress={() => setShowAddForm(true)} />
        )}

        <Button
          label={t('workouts.deleteWorkout')}
          variant="secondary"
          onPress={confirmDeleteWorkout}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  backButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  backText: { color: colors.accent, fontFamily: fontFamilies.medium, fontSize: typography.body },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  headingCopy: { flex: 1, gap: spacing[1] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
  volumeGroup: { alignItems: 'flex-end', gap: spacing[1] },
  volumeValue: { color: colors.accent, fontFamily: fontFamilies.bold, fontSize: typography.body },
  volumeLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  notes: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
  exerciseCard: {
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  exerciseHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  exerciseName: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  exerciseVolume: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  setRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  setText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  editForm: { flex: 1, gap: spacing[2], paddingVertical: spacing[2] },
  addForm: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  numberFields: { flexDirection: 'row', gap: spacing[2] },
  numberField: { flex: 1 },
  suggestions: { gap: spacing[1] },
  suggestion: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    backgroundColor: colors.accentSurface,
    borderRadius: radii[12],
  },
  suggestionText: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errorText: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.body },
  emptyText: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    textAlign: 'center',
  },
});
