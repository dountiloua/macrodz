import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { InfoCallout } from '@/components/ui/InfoCallout';
import { syncProfileAndUpdatePending } from '@/features/auth/sync-profile';
import { shiftLocalDate, toLocalDateString, parseLocalDate } from '@/features/diary';
import { formatDiaryEntryMacros } from '@/features/diary/nutrition';
import { useDiaryEntries, useDiaryFoodHistory, useDiaryMutations } from '@/features/diary/queries';
import { buildLogFoodParams } from '@/features/diary/navigation';
import { sumDiaryTotals } from '@/features/diary/totals';
import { MEALS, type DiaryEntry, type DiaryFood, type Meal } from '@/features/diary/types';
import {
  createGenericFoodCandidates,
  createHistoryFoodCandidates,
  suggestCloseMacros,
} from '@/features/close-macros';
import type { CloseMacrosSuggestionItem } from '@/features/close-macros';
import { GENERIC_FOODS } from '@/features/generic-foods';
import { useAuthStore } from '@/store/auth-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';
import { VOLUME_UNIT_ML } from '@/features/serving-units';

const EMPTY_DIARY_ENTRIES: DiaryEntry[] = [];

function MacroBar({
  label,
  eaten,
  target,
  unit,
  remainingLabel,
}: {
  label: string;
  eaten: number;
  target: number;
  unit: string;
  remainingLabel: (amount: number, unit: string) => string;
}) {
  const ratio = target > 0 ? eaten / target : eaten > 0 ? 1 : 0;
  const width = `${Math.min(ratio * 100, 100)}%` as `${number}%`;

  return (
    <View style={styles.macroBlock}>
      <View style={styles.macroHeading}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroNumbers}>
          {Math.round(eaten)} / {Math.round(target)} {unit}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width }, ratio > 1 ? styles.barOverTarget : null]} />
      </View>
      <Text style={styles.remainingText}>
        {remainingLabel(Math.round(Math.max(target - eaten, 0)), unit)}
      </Text>
    </View>
  );
}

export default function DiaryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const targets = useProfileStore((state) => state.targets);
  const pendingSync = useProfileStore((state) => state.pendingSync);
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const [suggestionMeal, setSuggestionMeal] = useState<Meal>('snack');
  const [mutationError, setMutationError] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const query = useDiaryEntries(user?.id, date);
  const historyQuery = useDiaryFoodHistory(user?.id, date);
  const mutations = useDiaryMutations(user?.id ?? '', date);
  const entries = query.data ?? EMPTY_DIARY_ENTRIES;
  const totals = useMemo(() => sumDiaryTotals(entries), [entries]);
  const isToday = date === toLocalDateString(new Date());
  const language = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const macroFormat = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  const displayDate = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseLocalDate(date));
  const languageCode = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const remainingMacros = useMemo(
    () => ({
      kcal: (targets?.calories ?? 0) - totals.kcal,
      protein: (targets?.proteinG ?? 0) - totals.protein,
      carbs: (targets?.carbsG ?? 0) - totals.carbs,
      fat: (targets?.fatG ?? 0) - totals.fat,
    }),
    [targets, totals],
  );
  const closeMacrosResult = useMemo(() => {
    if (!profile || !targets) return null;
    return suggestCloseMacros({
      remaining: remainingMacros,
      goal: profile.goal,
      foods: [
        ...createGenericFoodCandidates(GENERIC_FOODS, languageCode),
        ...createHistoryFoodCandidates(historyQuery.data ?? []),
      ],
    });
  }, [historyQuery.data, languageCode, profile, remainingMacros, targets]);

  function addSuggestedFood(item: CloseMacrosSuggestionItem) {
    const food: DiaryFood = {
      name: item.food.name,
      kcal: item.food.kcal,
      protein: item.food.protein,
      carbs: item.food.carbs,
      fat: item.food.fat,
      ...(item.food.servingQuantityG === undefined
        ? {}
        : { servingQuantityG: item.food.servingQuantityG }),
    };
    router.push({
      pathname: '/log-food',
      params: {
        ...buildLogFoodParams(date, suggestionMeal, food),
        grams: String(item.grams),
      },
    });
  }

  async function retryProfileSync() {
    if (!user || !profile || !targets || isRetryingSync) return;

    setIsRetryingSync(true);
    try {
      const result = await syncProfileAndUpdatePending(profile, targets, user.id);
      if (!result.ok) {
        console.warn('Profile sync retry failed.', result.error);
      }
    } finally {
      setIsRetryingSync(false);
    }
  }

  function openLog(entry: DiaryEntry) {
    const gramsFactor = entry.grams > 0 ? 100 / entry.grams : 0;
    const food: DiaryFood = {
      name: entry.product_name,
      kcal: entry.kcal * gramsFactor,
      protein: entry.protein * gramsFactor,
      carbs: entry.carbs * gramsFactor,
      fat: entry.fat * gramsFactor,
      productId: entry.product_id ?? undefined,
      ...(entry.unit === 'unit' || entry.unit === 'pot'
        ? { servingQuantityG: entry.grams / entry.quantity }
        : {}),
      ...(entry.unit === 'ml' ||
      entry.unit === 'tsp' ||
      entry.unit === 'tbsp' ||
      entry.unit === 'glass' ||
      entry.unit === 'cup'
        ? {
            densityGPerMl:
              entry.grams /
              (entry.quantity * (entry.unit === 'ml' ? 1 : VOLUME_UNIT_ML[entry.unit])),
          }
        : {}),
    };
    router.push({
      pathname: '/log-food',
      params: {
        ...buildLogFoodParams(date, entry.meal, food, {
          entryId: entry.id,
          quantity: entry.quantity,
          unit: entry.unit,
        }),
        grams: String(entry.grams),
      },
    });
  }

  function confirmDelete(entry: DiaryEntry) {
    Alert.alert(t('diary.deleteTitle'), t('diary.deleteConfirm', { name: entry.product_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('diary.delete'),
        style: 'destructive',
        onPress: () => {
          setMutationError(false);
          void mutations.remove.mutateAsync(entry.id).catch(() => setMutationError(true));
        },
      },
    ]);
  }

  function addFood(meal: Meal) {
    router.push({ pathname: '/add-food', params: { date, meal } });
  }

  return (
    <Screen padding={0} style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.title}>{t('tabs.diary')}</Text>

        {pendingSync ? (
          <View style={styles.syncNotice}>
            <InfoCallout message={t('diary.syncPending')} />
            <Button
              label={isRetryingSync ? t('diary.syncing') : t('diary.retrySync')}
              disabled={isRetryingSync}
              onPress={() => void retryProfileSync()}
              variant="secondary"
            />
          </View>
        ) : null}
        {mutationError ? <Text style={styles.errorText}>{t('diary.saveError')}</Text> : null}

        <View style={styles.dateCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diary.previousDay')}
            onPress={() => setDate((current) => shiftLocalDate(current, -1))}
            style={styles.dateArrow}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.dateCopy}>
            <Text style={styles.dateTitle}>{displayDate}</Text>
            {!isToday ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setDate(toLocalDateString(new Date()))}
                style={styles.todayButton}
              >
                <Text style={styles.todayText}>{t('diary.today')}</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diary.nextDay')}
            onPress={() => setDate((current) => shiftLocalDate(current, 1))}
            style={styles.dateArrow}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{t('diary.dailySummary')}</Text>
          <View style={styles.calorieSummary}>
            <Text style={styles.calorieValue}>{Math.round(totals.kcal)}</Text>
            <Text style={styles.calorieTarget}>
              / {Math.round(targets?.calories ?? 0)} {t('common.units.kcal')}
            </Text>
          </View>
          <Text style={styles.remainingText}>
            {Math.round(Math.max((targets?.calories ?? 0) - totals.kcal, 0))}{' '}
            {t('common.units.kcal')} {t('diary.remaining')}
          </Text>
          <View style={styles.macroList}>
            <MacroBar
              label={t('diary.protein')}
              eaten={totals.protein}
              target={targets?.proteinG ?? 0}
              unit={t('common.units.g')}
              remainingLabel={(amount, unit) => t('diary.macroRemaining', { amount, unit })}
            />
            <MacroBar
              label={t('diary.carbs')}
              eaten={totals.carbs}
              target={targets?.carbsG ?? 0}
              unit={t('common.units.g')}
              remainingLabel={(amount, unit) => t('diary.macroRemaining', { amount, unit })}
            />
            <MacroBar
              label={t('diary.fat')}
              eaten={totals.fat}
              target={targets?.fatG ?? 0}
              unit={t('common.units.g')}
              remainingLabel={(amount, unit) => t('diary.macroRemaining', { amount, unit })}
            />
          </View>
        </View>

        <View style={styles.closeMacrosCard}>
          <Text style={styles.cardTitle}>{t('closeMacros.title')}</Text>
          <Text style={styles.closeMacrosNote}>{t('closeMacros.note')}</Text>
          <View style={styles.remainingMacros}>
            {[
              {
                label: t('diary.calories'),
                value: remainingMacros.kcal,
                unit: t('common.units.kcal'),
              },
              {
                label: t('diary.protein'),
                value: remainingMacros.protein,
                unit: t('common.units.g'),
              },
              {
                label: t('diary.carbs'),
                value: remainingMacros.carbs,
                unit: t('common.units.g'),
              },
              {
                label: t('diary.fat'),
                value: remainingMacros.fat,
                unit: t('common.units.g'),
              },
            ].map((macro) => (
              <View key={macro.label} style={styles.remainingMacro}>
                <Text style={styles.remainingMacroLabel}>{macro.label}</Text>
                <Text style={styles.remainingMacroValue}>
                  {macroFormat.format(Math.max(macro.value, 0))} {macro.unit}
                </Text>
              </View>
            ))}
          </View>
          {!targets || !profile ? (
            <Text style={styles.closeMacrosMessage}>{t('closeMacros.noTargets')}</Text>
          ) : query.isLoading || historyQuery.isLoading ? (
            <View style={styles.suggestionsLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : query.isError || historyQuery.isError ? (
            <View style={styles.closeMacrosState}>
              <Text style={styles.closeMacrosMessage}>
                {query.isError ? t('diary.loadError') : t('closeMacros.historyError')}
              </Text>
              <Button
                label={t('diary.retry')}
                variant="secondary"
                onPress={() => {
                  if (query.isError) void query.refetch();
                  if (historyQuery.isError) void historyQuery.refetch();
                }}
              />
            </View>
          ) : closeMacrosResult?.status === 'target_reached' ? (
            <Text style={styles.closeMacrosMessage}>{t('closeMacros.targetReached')}</Text>
          ) : closeMacrosResult?.status === 'no_fit' ? (
            <Text style={styles.closeMacrosMessage}>{t('closeMacros.noSuggestions')}</Text>
          ) : closeMacrosResult?.status === 'suggestions' ? (
            <>
              <Text style={styles.mealChoiceLabel}>{t('closeMacros.addToMeal')}</Text>
              <View style={styles.mealChoices}>
                {MEALS.map((meal) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: suggestionMeal === meal }}
                    key={meal}
                    onPress={() => setSuggestionMeal(meal)}
                    style={[
                      styles.mealChoice,
                      suggestionMeal === meal ? styles.mealChoiceSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mealChoiceText,
                        suggestionMeal === meal ? styles.mealChoiceTextSelected : null,
                      ]}
                    >
                      {t(`diary.meals.${meal}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.suggestionsList}>
                {closeMacrosResult.suggestions.map((suggestion) => (
                  <View
                    key={suggestion.items.map((item) => `${item.food.id}-${item.grams}`).join('|')}
                    style={styles.suggestion}
                  >
                    <Text style={styles.suggestionName}>
                      {suggestion.items.map((item) => item.food.name).join(' + ')}
                    </Text>
                    <View style={styles.suggestionItems}>
                      {suggestion.items.map((item) => (
                        <View key={`${item.food.id}-${item.grams}`} style={styles.suggestionItem}>
                          <Text style={styles.suggestionPortion}>
                            {item.food.name} · {item.grams} {t('common.units.g')}
                          </Text>
                          <Button
                            label={t('closeMacros.addFood', { food: item.food.name })}
                            onPress={() => addSuggestedFood(item)}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={styles.suggestionResult}>
                      {t('closeMacros.resultSummary', {
                        kcal: macroFormat.format(suggestion.kcal),
                        protein: macroFormat.format(suggestion.protein),
                        carbs: macroFormat.format(suggestion.carbs),
                        fat: macroFormat.format(suggestion.fat),
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {query.isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : query.isError ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('diary.loadError')}</Text>
            <Button
              label={t('diary.retry')}
              variant="secondary"
              onPress={() => void query.refetch()}
            />
          </View>
        ) : (
          MEALS.map((meal) => (
            <View key={meal} style={styles.mealCard}>
              <View style={styles.mealHeading}>
                <Text style={styles.mealTitle}>{t(`diary.meals.${meal}`)}</Text>
                <Text style={styles.mealCalories}>
                  {Math.round(
                    entries
                      .filter((entry) => entry.meal === meal)
                      .reduce((sum, entry) => sum + entry.kcal, 0),
                  )}{' '}
                  {t('common.units.kcal')}
                </Text>
              </View>
              {entries
                .filter((entry) => entry.meal === meal)
                .map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openLog(entry)}
                      style={styles.entryMain}
                    >
                      <Text style={styles.entryName}>{entry.product_name}</Text>
                      <Text style={styles.entryQuantity}>
                        {entry.quantity} {t(`common.units.${entry.unit}`)} · {entry.grams}{' '}
                        {t('common.units.g')}
                      </Text>
                      <Text style={styles.entryQuantity}>
                        {formatDiaryEntryMacros(entry, {
                          protein: t('diary.protein'),
                          carbs: t('diary.carbs'),
                          fat: t('diary.fat'),
                          unit: t('common.units.g'),
                        })}
                      </Text>
                    </Pressable>
                    <Text style={styles.entryKcal}>
                      {Math.round(entry.kcal)} {t('common.units.kcal')}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('diary.deleteEntry', { name: entry.product_name })}
                      onPress={() => confirmDelete(entry)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              <Button
                label={t('diary.addFood')}
                variant="secondary"
                onPress={() => addFood(meal)}
              />
            </View>
          ))
        )}
        {!query.isLoading && !query.isError && entries.length === 0 ? (
          <Text style={styles.emptyText}>{t('diary.emptyDay')}</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  syncNotice: { gap: spacing[2] },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    padding: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  dateArrow: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dateCopy: { flex: 1, alignItems: 'center', gap: spacing[1] },
  dateTitle: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  todayButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing[3] },
  todayText: {
    color: colors.accent,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  summaryCard: {
    padding: spacing[4],
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  closeMacrosCard: {
    padding: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  closeMacrosNote: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  remainingMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  remainingMacro: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: spacing[1],
    padding: spacing[3],
    backgroundColor: colors.background,
    borderRadius: radii[12],
  },
  remainingMacroLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  remainingMacroValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  closeMacrosState: { gap: spacing[2] },
  closeMacrosMessage: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
  },
  suggestionsLoading: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  mealChoiceLabel: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  mealChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  mealChoice: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radii[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  mealChoiceSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  mealChoiceText: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  mealChoiceTextSelected: { color: colors.text },
  suggestionsList: { gap: spacing[2] },
  suggestion: {
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.background,
    borderRadius: radii[12],
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionName: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  suggestionItems: { gap: spacing[2] },
  suggestionItem: { gap: spacing[1] },
  suggestionPortion: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  suggestionResult: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  cardTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  calorieSummary: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  calorieValue: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: 36 },
  calorieTarget: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
  },
  remainingText: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  macroList: { gap: spacing[3], marginTop: spacing[2] },
  macroBlock: { gap: spacing[1] },
  macroHeading: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  macroNumbers: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  barTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radii[12],
    backgroundColor: colors.border,
  },
  barFill: { height: '100%', backgroundColor: colors.accent },
  barOverTarget: { backgroundColor: colors.error },
  stateBox: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errorText: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.body },
  emptyText: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    textAlign: 'center',
  },
  mealCard: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  mealHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  mealCalories: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  entryMain: { flex: 1, minHeight: 52, justifyContent: 'center', gap: spacing[1] },
  entryName: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  entryQuantity: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  entryKcal: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  deleteButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
