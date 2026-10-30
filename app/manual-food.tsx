import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { validateManualProduct, type ManualProductInput } from '@/features/food-lookup';
import {
  buildLogFoodParams,
  insertUserProduct,
  hasUsableNutrition,
  readSingleParam,
  type Meal,
} from '@/features/diary';
import { MEALS } from '@/features/diary/types';
import { useAuthStore } from '@/store/auth-store';
import { colors, fontFamilies, spacing, typography } from '@/theme/tokens';

function isMeal(value: string | undefined): value is Meal {
  return value !== undefined && (MEALS as readonly string[]).includes(value);
}

const initialProduct: ManualProductInput = {
  barcode: '',
  name: '',
  brand: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  servingQuantityG: '',
};

export default function ManualFoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = readSingleParam(params.date) ?? '';
  const mealValue = readSingleParam(params.meal);
  const meal = isMeal(mealValue) ? mealValue : 'snack';
  const user = useAuthStore((state) => state.user);
  const [values, setValues] = useState<ManualProductInput>(initialProduct);
  const [invalidBarcode, setInvalidBarcode] = useState(false);
  const [invalidProduct, setInvalidProduct] = useState(false);
  const [nutritionMissing, setNutritionMissing] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof ManualProductInput>(key: K, value: ManualProductInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setNutritionMissing(false);
  }

  async function save() {
    const validation = validateManualProduct(values);
    if (!validation.ok || !/^\d{8,14}$/.test(values.barcode.trim()) || !user) {
      setInvalidBarcode(!/^\d{8,14}$/.test(values.barcode.trim()));
      setInvalidProduct(!validation.ok);
      setNutritionMissing(false);
      setError(!user);
      return;
    }
    if (!hasUsableNutrition(validation.product)) {
      setNutritionMissing(true);
      return;
    }

    setSaving(true);
    setInvalidProduct(false);
    setNutritionMissing(false);
    setError(false);
    try {
      const product = validation.product;
      const productId = await insertUserProduct(user.id, {
        name: product.name,
        brand: product.brand,
        barcode: product.barcode,
        kcal: product.kcal,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        servingQuantityG: product.servingQuantityG,
      });
      router.replace({
        pathname: '/log-food',
        params: buildLogFoodParams(date, meal, {
          name: product.name,
          kcal: product.kcal,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          servingQuantityG: product.servingQuantityG,
          productId,
        }),
      });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padding={0} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        <Text style={styles.title}>{t('diary.manualFoodTitle')}</Text>
        <Text style={styles.description}>{t('diary.manualProductInfo')}</Text>
        <TextField
          label={`${t('scan.manualModal.title')} *`}
          value={values.barcode}
          onChangeText={(value) => {
            setField('barcode', value);
            setInvalidBarcode(false);
          }}
          placeholder={t('scan.manualModal.placeholder')}
          keyboardType="number-pad"
          maxLength={14}
          error={invalidBarcode ? t('diary.invalidBarcode') : null}
        />
        <TextField
          label={`${t('scan.manualForm.nameLabel')} *`}
          value={values.name}
          onChangeText={(value) => setField('name', value)}
          placeholder={t('scan.manualForm.namePlaceholder')}
        />
        <TextField
          label={t('scan.manualForm.brandLabel')}
          value={values.brand ?? ''}
          onChangeText={(value) => setField('brand', value)}
          placeholder={t('scan.manualForm.brandPlaceholder')}
        />
        <TextField
          label={`${t('scan.manualForm.kcalLabel')} *`}
          value={String(values.kcal)}
          onChangeText={(value) => setField('kcal', value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label={`${t('scan.manualForm.proteinLabel')} *`}
          value={String(values.protein)}
          onChangeText={(value) => setField('protein', value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label={`${t('scan.manualForm.carbsLabel')} *`}
          value={String(values.carbs)}
          onChangeText={(value) => setField('carbs', value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label={`${t('scan.manualForm.fatLabel')} *`}
          value={String(values.fat)}
          onChangeText={(value) => setField('fat', value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('scan.manualForm.servingQuantityGLabel')}
          value={String(values.servingQuantityG ?? '')}
          onChangeText={(value) => setField('servingQuantityG', value)}
          keyboardType="decimal-pad"
        />
        {invalidProduct ? <Text style={styles.error}>{t('diary.manualInvalid')}</Text> : null}
        {nutritionMissing ? (
          <Text style={styles.error}>{t('diary.nutritionMissing')}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{t('diary.saveError')}</Text> : null}
        <Button label={t('diary.saveAndLog')} loading={saving} onPress={() => void save()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  description: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  error: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.caption },
});
