import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

const emptyProduct: ManualProductInput = {
  barcode: '',
  name: '',
  brand: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  sugars: '',
  fiber: '',
  saturatedFat: '',
  salt: '',
  alcohol: '',
  kind: 'solid',
  servingQuantityG: '',
};

export default function ManualFoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const date = readSingleParam(params.date) ?? '';
  const mealValue = readSingleParam(params.meal);
  const meal = isMeal(mealValue) ? mealValue : 'snack';
  const correction = readSingleParam(params.correction) === 'true';
  const user = useAuthStore((state) => state.user);
  const [values, setValues] = useState<ManualProductInput>(() => ({
    ...emptyProduct,
    ...(correction
      ? {
          barcode: readSingleParam(params.barcode) ?? '',
          name: readSingleParam(params.name) ?? '',
          brand: readSingleParam(params.brand) ?? '',
          kcal: readSingleParam(params.kcal) ?? '',
          protein: readSingleParam(params.protein) ?? '',
          carbs: readSingleParam(params.carbs) ?? '',
          fat: readSingleParam(params.fat) ?? '',
          kind: readSingleParam(params.kind) === 'liquid' ? 'liquid' : 'solid',
          servingQuantityG: readSingleParam(params.servingQuantityG) ?? '',
          sugars: readSingleParam(params.sugars) ?? '',
          fiber: readSingleParam(params.fiber) ?? '',
          saturatedFat: readSingleParam(params.saturatedFat) ?? '',
          salt: readSingleParam(params.salt) ?? '',
          alcohol: readSingleParam(params.alcohol) ?? '',
        }
      : {}),
  }));
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
    const barcodeIsInvalid = !correction && !/^\d{8,14}$/.test(values.barcode.trim());
    if (!validation.ok || barcodeIsInvalid || !user) {
      setInvalidBarcode(barcodeIsInvalid);
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
      const productId = correction
        ? readSingleParam(params.productId)
        : await insertUserProduct(user.id, {
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
        params: {
          ...buildLogFoodParams(date, meal, {
            name: product.name,
            brand: product.brand,
            barcode: product.barcode,
            kcal: product.kcal,
            protein: product.protein,
            carbs: product.carbs,
            fat: product.fat,
            sugars: product.sugars,
            fiber: product.fiber,
            saturatedFat: product.saturatedFat,
            salt: product.salt,
            alcohol: product.alcohol,
            kind: product.kind,
            servingQuantityG: product.servingQuantityG,
            productId,
            source: product.source,
            imageUrl: readSingleParam(params.imageUrl) ?? undefined,
          }),
          productSheet: 'true',
        },
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
        <Text style={styles.description}>
          {t('diary.manualProductInfo', { unit: values.kind === 'liquid' ? '100 ml' : '100 g' })}
        </Text>
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
        <Text style={styles.label}>{t('scan.manualForm.productKindLabel')}</Text>
        <View style={styles.kindOptions}>
          {(['solid', 'liquid'] as const).map((kind) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: values.kind === kind }}
              key={kind}
              onPress={() => setField('kind', kind)}
              style={[styles.kindButton, values.kind === kind ? styles.selectedKind : null]}
            >
              <Text style={styles.kindText}>{t(`scan.manualForm.${kind}`)}</Text>
            </Pressable>
          ))}
        </View>
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
        {(['sugars', 'fiber', 'saturatedFat', 'salt', 'alcohol'] as const).map((field) => (
          <TextField
            key={field}
            label={t(`diary.productFlow.nutrients.${field}`)}
            value={String(values[field] ?? '')}
            onChangeText={(value) => setField(field, value)}
            keyboardType="decimal-pad"
          />
        ))}
        <TextField
          label={t(
            values.kind === 'liquid'
              ? 'scan.manualForm.servingQuantityMlLabel'
              : 'scan.manualForm.servingQuantityGLabel',
          )}
          value={String(values.servingQuantityG ?? '')}
          onChangeText={(value) => setField('servingQuantityG', value)}
          keyboardType="decimal-pad"
        />
        {invalidProduct ? <Text style={styles.error}>{t('diary.manualInvalid')}</Text> : null}
        {nutritionMissing ? <Text style={styles.error}>{t('diary.nutritionMissing')}</Text> : null}
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
  label: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  kindOptions: { flexDirection: 'row', gap: spacing[2] },
  kindButton: {
    minHeight: 48,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  selectedKind: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  kindText: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  error: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.caption },
});
