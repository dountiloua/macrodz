import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MetricRow } from '@/components/metric-row';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import {
  getDefaultLogAmount,
  hasUsableNutrition,
  readSingleParam,
  createDiaryEntryValues,
} from '@/features/diary';
import { useDiaryMutations } from '@/features/diary/queries';
import type { DiaryFood, Meal } from '@/features/diary/types';
import { MEALS } from '@/features/diary/types';
import {
  convertServing,
  getAvailableServingUnits,
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
  const date = readSingleParam(params.date) ?? '';
  const mealValue = readSingleParam(params.meal) ?? '';
  const meal = (MEALS as readonly string[]).includes(mealValue) ? (mealValue as Meal) : 'snack';
  const name = readSingleParam(params.name) ?? '';
  const gramsParam = readSingleParam(params.grams);
  const productId = readSingleParam(params.productId);
  const entryId = readSingleParam(params.entryId);
  const servingQuantityG = Number(readSingleParam(params.servingQuantityG));
  const densityGPerMl = Number(readSingleParam(params.densityGPerMl));
  const numericParam = (key: string) => Number(readSingleParam(params[key]));
  const food: DiaryFood = {
    name,
    kcal: numericParam('kcal'),
    protein: numericParam('protein'),
    carbs: numericParam('carbs'),
    fat: numericParam('fat'),
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
  const [initialAmount] = useState(() => {
    const suggested =
      gramsParam !== undefined &&
      Number.isFinite(Number(gramsParam)) &&
      Number(gramsParam) > 0 &&
      Number(gramsParam) <= 10_000
        ? { quantity: gramsParam, unit: 'g' as const }
        : getDefaultLogAmount(
            food.servingQuantityG,
            readSingleParam(params.quantity),
            readSingleParam(params.unit),
          );
    return getAvailableServingUnits(food, name).includes(suggested.unit)
      ? suggested
      : { quantity: '100', unit: 'g' as const };
  });
  const [quantity, setQuantity] = useState(initialAmount.quantity);
  const [unit, setUnit] = useState<ServingUnit>(initialAmount.unit);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutations = useDiaryMutations(user?.id ?? '', date);
  const units = getAvailableServingUnits(food, name);
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
        {isVolumeServingUnit(unit) &&
        food.densityGPerMl === undefined &&
        getProductDensityGPerMl(name) === undefined ? (
          <Text style={styles.warning}>{t('diary.approximateVolumeWarning')}</Text>
        ) : null}

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{t('diary.livePreview')}</Text>
          {nutritionValid && preview.ok ? (
            <>
              <MetricRow
                label={t('diary.grams')}
                value={`${preview.grams} ${t('common.units.g')}`}
              />
              <MetricRow
                label={t('diary.calories')}
                value={`${preview.kcal} ${t('common.units.kcal')}`}
              />
              <MetricRow
                label={t('diary.protein')}
                value={`${preview.protein} ${t('common.units.g')}`}
              />
              <MetricRow
                label={t('diary.carbs')}
                value={`${preview.carbs} ${t('common.units.g')}`}
              />
              <MetricRow label={t('diary.fat')} value={`${preview.fat} ${t('common.units.g')}`} />
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
