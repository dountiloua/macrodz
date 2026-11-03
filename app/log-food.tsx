import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MetricRow } from '@/components/metric-row';
import { ProductNutritionFlow } from '@/components/ProductNutritionFlow';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import {
  getDefaultLogAmount,
  getLogFoodUnitOptions,
  hasUsableNutrition,
  readSingleParam,
  createDiaryEntryValues,
  addDiaryEntry,
  diaryQueryKey,
  diaryFoodHistoryQueryKey,
} from '@/features/diary';
import { useDiaryMutations } from '@/features/diary/queries';
import type { DiaryFood, Meal } from '@/features/diary/types';
import { MEALS } from '@/features/diary/types';
import {
  convertServing,
  getProductDensityGPerMl,
  isVolumeServingUnit,
  type ServingUnit,
} from '@/features/serving-units';
import { useAuthStore } from '@/store/auth-store';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

export default function LogFoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const date = readSingleParam(params.date) ?? '';
  const mealValue = readSingleParam(params.meal) ?? '';
  const meal = (MEALS as readonly string[]).includes(mealValue) ? (mealValue as Meal) : 'snack';
  const name = readSingleParam(params.name) ?? '';
  const gramsParam = readSingleParam(params.grams);
  const productId = readSingleParam(params.productId);
  const entryId = readSingleParam(params.entryId);
  const servingQuantityG = Number(readSingleParam(params.servingQuantityG));
  const densityGPerMl = Number(readSingleParam(params.densityGPerMl));
  const kindParam = readSingleParam(params.kind);
  const kind = kindParam === 'liquid' ? 'liquid' : 'solid';
  const numericParam = (key: string) => Number(readSingleParam(params[key]));
  const optionalNumericParam = (key: string) => {
    const value = readSingleParam(params[key]);
    return value === undefined || value.length === 0 ? undefined : Number(value);
  };
  const food: DiaryFood = {
    kind,
    name,
    brand: readSingleParam(params.brand),
    barcode: readSingleParam(params.barcode),
    imageUrl: readSingleParam(params.imageUrl),
    source:
      readSingleParam(params.source) === 'user'
        ? 'user'
        : readSingleParam(params.source) === 'generic'
          ? 'generic'
          : 'off',
    kcal: numericParam('kcal'),
    protein: numericParam('protein'),
    carbs: numericParam('carbs'),
    fat: numericParam('fat'),
    sugars: optionalNumericParam('sugars'),
    fiber: optionalNumericParam('fiber'),
    saturatedFat: optionalNumericParam('saturatedFat'),
    salt: optionalNumericParam('salt'),
    alcohol: optionalNumericParam('alcohol'),
    ...(Number.isFinite(servingQuantityG) && servingQuantityG > 0 ? { servingQuantityG } : {}),
    ...(Number.isFinite(densityGPerMl) && densityGPerMl > 0
      ? { densityGPerMl }
      : getProductDensityGPerMl(name) !== undefined
        ? { densityGPerMl: getProductDensityGPerMl(name) }
        : {}),
    ...(productId ? { productId } : {}),
  };
  const validFood =
    food.name.length > 0 &&
    [food.kcal, food.protein, food.carbs, food.fat].every(
      (value) => Number.isFinite(value) && value >= 0,
    );
  const nutritionValid = hasUsableNutrition(food);
  const units = getLogFoodUnitOptions(food);
  const [initialAmount] = useState(() => {
    const suggested =
      gramsParam !== undefined &&
      Number.isFinite(Number(gramsParam)) &&
      Number(gramsParam) > 0 &&
      Number(gramsParam) <= 10_000
        ? { quantity: gramsParam, unit: kind === 'liquid' ? ('ml' as const) : ('g' as const) }
        : getDefaultLogAmount(
            food.servingQuantityG,
            readSingleParam(params.quantity),
            readSingleParam(params.unit),
            kind,
          );
    return units.includes(suggested.unit)
      ? suggested
      : getDefaultLogAmount(food.servingQuantityG, undefined, undefined, kind);
  });
  const [quantity, setQuantity] = useState(initialAmount.quantity);
  const [unit, setUnit] = useState<ServingUnit>(initialAmount.unit);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutations = useDiaryMutations(user?.id ?? '', date);
  const productSheet = readSingleParam(params.productSheet) === 'true' && !entryId;
  const parsedQuantity = Number(quantity.replace(',', '.'));
  const preview = convertServing(food, parsedQuantity, unit);
  let canSave = false;
  if (user && validFood && nutritionValid && preview.ok) {
    try {
      createDiaryEntryValues({ userId: user.id, date, meal, food, quantity: parsedQuantity, unit });
      canSave = true;
    } catch {
      canSave = false;
    }
  }

  async function save() {
    if (!user || !validFood || !nutritionValid || !preview.ok) {
      setError(true);
      return;
    }

    setSaving(true);
    setError(false);
    try {
      const values = createDiaryEntryValues({
        userId: user.id,
        date,
        meal,
        food,
        quantity: Number(quantity.replace(',', '.')),
        unit,
      });

      if (entryId) {
        const {
          user_id: _userId,
          product_id: _productId,
          product_name: _name,
          log_date: _date,
          meal: _meal,
          ...update
        } = values;
        await mutations.update.mutateAsync({ entryId, values: update });
      } else {
        await mutations.add.mutateAsync(values);
      }

      router.back();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (productSheet && validFood) {
    return (
      <ProductNutritionFlow
        product={food}
        destination="diary"
        initialDate={date || undefined}
        initialMeal={meal}
        onDismiss={() => router.back()}
        onCorrectValues={() =>
          router.replace({
            pathname: '/manual-food',
            params: {
              correction: 'true',
              date,
              meal,
              name: food.name,
              brand: food.brand ?? '',
              barcode: food.barcode ?? '',
              kcal: String(food.kcal),
              protein: String(food.protein),
              carbs: String(food.carbs),
              fat: String(food.fat),
              kind,
              servingQuantityG: String(food.servingQuantityG ?? ''),
              sugars: String(food.sugars ?? ''),
              fiber: String(food.fiber ?? ''),
              saturatedFat: String(food.saturatedFat ?? ''),
              salt: String(food.salt ?? ''),
              alcohol: String(food.alcohol ?? ''),
              productId: food.productId ?? '',
              imageUrl: food.imageUrl ?? '',
            },
          })
        }
        onAdd={async ({ quantity: amount, unit: servingUnit, date: selectedDate, meal: selectedMeal }) => {
          if (!user || !nutritionValid) throw new Error('Diary entry is unavailable.');
          const values = createDiaryEntryValues({
            userId: user.id,
            date: selectedDate,
            meal: selectedMeal,
            food,
            quantity: amount,
            unit: servingUnit,
          });
          await addDiaryEntry(values);
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: diaryQueryKey(user.id, selectedDate) }),
            queryClient.invalidateQueries({
              queryKey: diaryFoodHistoryQueryKey(user.id, selectedDate),
            }),
          ]).catch((error: unknown) => {
            console.warn('Unable to refresh diary queries after adding a food.', error);
          });
          router.back();
        }}
      />
    );
  }

  if (!validFood) {
    return (
      <Screen style={styles.screen}>
        <Text style={styles.error}>{t('diary.loadError')}</Text>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen padding={0} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        <Text style={styles.title}>{entryId ? t('diary.editEntry') : t('diary.logFoodTitle')}</Text>
        <View style={styles.foodCard}>
          <Text style={styles.foodName}>{food.name}</Text>
          <Text style={styles.mealName}>{t(`diary.meals.${meal}`)}</Text>
        </View>
        {!nutritionValid ? <Text style={styles.error}>{t('diary.nutritionMissing')}</Text> : null}

        <Text style={styles.label}>{t('diary.quantity')}</Text>
        <TextInput
          accessibilityLabel={t('diary.quantity')}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="100"
          placeholderTextColor={colors.muted}
          style={styles.quantityInput}
        />

        <Text style={styles.label}>{t('diary.unit')}</Text>
        <View style={styles.unitList}>
          {units.map((servingUnit) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: servingUnit === unit }}
              key={servingUnit}
              onPress={() => setUnit(servingUnit)}
              style={[styles.unitButton, servingUnit === unit ? styles.selectedUnit : null]}
            >
              <Text style={styles.unitText}>{t(`common.units.${servingUnit}`)}</Text>
            </Pressable>
          ))}
        </View>
        {kind !== 'liquid' &&
        isVolumeServingUnit(unit) &&
        food.densityGPerMl === undefined &&
        getProductDensityGPerMl(name) === undefined ? (
          <Text style={styles.warning}>{t('diary.approximateVolumeWarning')}</Text>
        ) : null}

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{t('diary.livePreview')}</Text>
          {nutritionValid && preview.ok ? (
            <>
              <MetricRow
                label={kind === 'liquid' ? t('diary.milliliters') : t('diary.grams')}
                value={`${preview.grams} ${t(`common.units.${kind === 'liquid' ? 'ml' : 'g'}`)}`}
              />
              <MetricRow
                label={t('diary.calories')}
                value={`${Math.round(preview.kcal)} ${t('common.units.kcal')}`}
              />
              <MetricRow
                label={t('diary.protein')}
                value={`${preview.protein.toFixed(1)} ${t('common.units.g')}`}
              />
              <MetricRow
                label={t('diary.carbs')}
                value={`${preview.carbs.toFixed(1)} ${t('common.units.g')}`}
              />
              <MetricRow
                label={t('diary.fat')}
                value={`${preview.fat.toFixed(1)} ${t('common.units.g')}`}
              />
            </>
          ) : null}
        </View>
        {!canSave && nutritionValid ? (
          <Text style={styles.error}>{t('diary.quantityError')}</Text>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {t('diary.saveError')}
          </Text>
        ) : null}
        <Button
          label={t('common.save')}
          loading={saving}
          disabled={!canSave}
          onPress={() => void save()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  foodCard: {
    padding: spacing[4],
    gap: spacing[1],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  foodName: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  mealName: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.caption },
  label: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  quantityInput: {
    minHeight: 54,
    paddingHorizontal: spacing[4],
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.heading,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
  },
  unitList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  unitButton: {
    minHeight: 48,
    minWidth: 64,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  selectedUnit: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  unitText: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  previewCard: {
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewTitle: {
    marginBottom: spacing[2],
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  error: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  warning: {
    color: colors.muted,
    fontSize: typography.caption,
  },
});
