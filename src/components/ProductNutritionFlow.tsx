import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { hasInconsistentCalories } from '@/features/food-lookup';
import { formatCalories, formatMacro } from '@/features/product-flow/format';
import { transitionProductFlow } from '@/features/product-flow/state';
import type { ProductFlowStep } from '@/features/product-flow/state';
import type { Meal } from '@/features/diary/types';
import { MEALS } from '@/features/diary/types';
import { toLocalDateString } from '@/features/diary/date';
import {
  convertServing,
  getCalculatorUnits,
  getEquivalentAmounts,
  getEquivalentUnits,
  getProductDensityGPerMl,
  type ServingProduct,
  type ServingUnit,
} from '@/features/serving-units';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

export type ProductFlowProduct = ServingProduct & {
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  source?: 'off' | 'user' | 'generic';
};

export type ProductFlowAmount = {
  quantity: number;
  unit: ServingUnit;
  date: string;
  meal: Meal;
};

type Props = {
  product: ProductFlowProduct;
  destination: 'diary' | 'meal';
  initialDate?: string;
  initialMeal?: Meal;
  onDismiss: () => void;
  onCorrectValues: () => void;
  onAdd: (amount: ProductFlowAmount) => Promise<void>;
  duplicate?: {
    message: string;
    quantity: number;
    unit: ServingUnit;
    onUpdate: (amount: ProductFlowAmount) => Promise<void>;
  };
  addErrorKey?: 'diary.saveError' | 'buildMeal.invalidAmount' | 'buildMeal.limitReached';
};

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function MetricValue({
  label,
  value,
  unit,
  calories = false,
  emphasis = false,
}: {
  label: string;
  value: number | undefined;
  unit: string;
  calories?: boolean;
  emphasis?: boolean;
}) {
  const formatted = calories ? formatCalories(value) : formatMacro(value);
  return (
    <View style={[styles.metric, emphasis ? styles.emphasizedMetric : null]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, emphasis ? styles.calorieValue : null]}>
        {formatted} <Text style={styles.metricUnit}>{unit}</Text>
      </Text>
    </View>
  );
}

function NutritionSummary({
  product,
  serving = false,
}: {
  product: ProductFlowProduct;
  serving?: boolean;
}) {
  const { t } = useTranslation();
  const multiplier = serving ? (product.servingQuantityG ?? 0) / 100 : 1;
  const value = (nutrient: number | undefined) =>
    nutrient === undefined ? undefined : nutrient * multiplier;
  const basis = product.kind === 'liquid' ? 'ml' : 'g';
  const metrics: {
    key: 'protein' | 'carbs' | 'fat' | 'sugars' | 'fiber' | 'saturatedFat' | 'salt' | 'alcohol';
    value: number | undefined;
    unit: 'g';
  }[] = [
    { key: 'protein', value: value(product.protein), unit: 'g' },
    { key: 'carbs', value: value(product.carbs), unit: 'g' },
    { key: 'fat', value: value(product.fat), unit: 'g' },
    { key: 'sugars', value: value(product.sugars), unit: 'g' },
    { key: 'fiber', value: value(product.fiber), unit: 'g' },
    { key: 'saturatedFat', value: value(product.saturatedFat), unit: 'g' },
    { key: 'salt', value: value(product.salt), unit: 'g' },
    { key: 'alcohol', value: value(product.alcohol), unit: 'g' },
  ];

  return (
    <View style={styles.nutritionBlock}>
      <Text style={styles.nutritionHeading}>
        {serving
          ? t('diary.productFlow.perServing', {
              quantity: formatAmount(product.servingQuantityG ?? 0),
              unit: t(`common.units.${basis}`),
            })
          : t(product.kind === 'liquid' ? 'diary.productFlow.per100ml' : 'diary.productFlow.per100g')}
      </Text>
      <MetricValue
        label={t('diary.calories')}
        value={value(product.kcal)}
        unit={t('common.units.kcal')}
        calories
        emphasis
      />
      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <MetricValue
            key={metric.key}
            label={t(`diary.productFlow.nutrients.${metric.key}`)}
            value={metric.value}
            unit={t(`common.units.${metric.unit}`)}
          />
        ))}
      </View>
    </View>
  );
}

export function ProductNutritionFlow({
  product,
  destination,
  initialDate,
  initialMeal = 'snack',
  onDismiss,
  onCorrectValues,
  onAdd,
  duplicate,
  addErrorKey,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ProductFlowStep>('sheet');
  const [imageFailed, setImageFailed] = useState(false);
  const calculatorUnits = getCalculatorUnits(product);
  const initialUnit: ServingUnit = product.kind === 'liquid' ? 'ml' : 'g';
  const [quantity, setQuantity] = useState(
    product.kind === 'solid' && product.servingQuantityG !== undefined ? '1' : '100',
  );
  const [unit, setUnit] = useState<ServingUnit>(
    product.kind === 'solid' && product.servingQuantityG !== undefined ? 'unit' : initialUnit,
  );
  const [date, setDate] = useState(initialDate ?? toLocalDateString(new Date()));
  const [meal, setMeal] = useState(initialMeal);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const quantityNumber = Number(quantity.replace(',', '.'));
  const hasValidAmount = Number.isFinite(quantityNumber) && quantityNumber > 0;
  const resolvedProduct: ProductFlowProduct = {
    ...product,
    densityGPerMl:
      product.kind === 'liquid'
        ? undefined
        : (product.densityGPerMl ?? getProductDensityGPerMl(product.name)),
  };
  const conversion = hasValidAmount ? convertServing(resolvedProduct, quantityNumber, unit) : null;
  const equivalentUnits = getEquivalentUnits(resolvedProduct, product.name);
  const equivalents = hasValidAmount
    ? getEquivalentAmounts(resolvedProduct, quantityNumber, unit, product.name)
    : [];
  const equivalentValues = new Map(equivalents.map((entry) => [entry.unit, entry.quantity]));
  const warning = hasInconsistentCalories(product);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 80) {
            setStep((current) => transitionProductFlow(current, 'dismiss'));
            onDismiss();
          }
        },
      }),
    [onDismiss],
  );

  async function add() {
    if (!hasValidAmount || !conversion?.ok || (destination === 'diary' && !date.trim())) {
      setSubmitError(true);
      return;
    }

    setSaving(true);
    setSubmitError(false);
    try {
      const amount = { quantity: quantityNumber, unit, date, meal };
      if (editingExisting && duplicate) {
        await duplicate.onUpdate(amount);
      } else {
        await onAdd(amount);
      }
    } catch {
      setSubmitError(true);
    } finally {
      setSaving(false);
    }
  }

  if (step === 'closed') return null;

  return (
    <>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setStep((current) => transitionProductFlow(current, 'dismiss'));
          onDismiss();
        }}
        statusBarTranslucent
        transparent
        visible={step === 'sheet'}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diary.productFlow.dismiss')}
            onPress={() => {
              setStep((current) => transitionProductFlow(current, 'dismiss'));
              onDismiss();
            }}
            style={styles.backdrop}
          />
          <View style={styles.sheet}>
            <View {...panResponder.panHandlers} style={styles.dragArea}>
              <View style={styles.dragHandle} />
            </View>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.productHeading}>
                <View style={styles.sheetImageFrame}>
                  {product.imageUrl && !imageFailed ? (
                    <Image
                      accessibilityLabel={product.name}
                      contentFit="contain"
                      onError={() => setImageFailed(true)}
                      source={{ uri: product.imageUrl }}
                      style={styles.sheetImage}
                    />
                  ) : (
                    <Ionicons name="image-outline" size={32} color={colors.muted} />
                  )}
                </View>
                <View style={styles.productCopy}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {product.brand ? <Text style={styles.productBrand}>{product.brand}</Text> : null}
                </View>
              </View>
              <Text style={styles.sourceLabel}>
                {t(
                  product.source === 'user'
                    ? 'diary.productFlow.sourceUser'
                    : product.source === 'generic'
                      ? 'diary.productFlow.sourceGeneric'
                      : 'diary.productFlow.sourceOff',
                )}
              </Text>
              <NutritionSummary product={product} />
              {product.servingQuantityG !== undefined && product.servingQuantityG > 0 ? (
                <NutritionSummary product={product} serving />
              ) : null}
              {warning ? (
                <View style={styles.warning}>
                  <Text style={styles.warningText}>{t('diary.productFlow.inaccurateWarning')}</Text>
                  <Button
                    label={t('diary.productFlow.correctValues')}
                    onPress={onCorrectValues}
                    variant="secondary"
                  />
                </View>
              ) : null}
              <View style={styles.sheetActions}>
                <Button
                  label={t('diary.productFlow.ok')}
                  onPress={() => setStep((current) => transitionProductFlow(current, 'ok'))}
                />
                <Button label={t('diary.productFlow.dismiss')} onPress={onDismiss} variant="secondary" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {step === 'calculator' ? (
        <Screen padding={0} style={styles.screen} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.calculatorContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.calculatorHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                onPress={onDismiss}
                style={styles.headerButton}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.calculatorTitle}>{product.name}</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.amountCard}>
              {duplicate && !editingExisting ? (
                <View style={styles.duplicatePrompt}>
                  <Text style={styles.duplicateText}>{duplicate.message}</Text>
                  <Button
                    label={t('buildMeal.changeAmount')}
                    variant="secondary"
                    onPress={() => {
                      setQuantity(String(duplicate.quantity));
                      setUnit(duplicate.unit);
                      setEditingExisting(true);
                    }}
                  />
                </View>
              ) : null}
              <Text style={styles.label}>{t('diary.quantity')}</Text>
              <View style={styles.amountRow}>
                <TextInput
                  accessibilityLabel={t('diary.quantity')}
                  keyboardType="decimal-pad"
                  onChangeText={setQuantity}
                  placeholder="100"
                  placeholderTextColor={colors.muted}
                  selectTextOnFocus
                  style={styles.amountInput}
                  value={quantity}
                />
                <Text style={styles.amountUnit}>{t(`common.units.${unit}`)}</Text>
              </View>
            </View>

            <View style={styles.quickChips}>
              {product.servingQuantityG !== undefined && product.servingQuantityG > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (product.kind === 'solid' && calculatorUnits.includes('unit')) {
                      setUnit('unit');
                      setQuantity('1');
                    } else {
                      setUnit(initialUnit);
                      setQuantity(String(product.servingQuantityG));
                    }
                  }}
                  style={styles.quickChip}
                >
                  <Text style={styles.quickChipText}>{t('diary.productFlow.servingChip')}</Text>
                </Pressable>
              ) : null}
              {[100, 250, 500].map((amount) => (
                <Pressable
                  accessibilityRole="button"
                  key={amount}
                  onPress={() => {
                    setUnit(initialUnit);
                    setQuantity(String(amount));
                  }}
                  style={styles.quickChip}
                >
                  <Text style={styles.quickChipText}>
                    {amount} {t(`common.units.${initialUnit}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t('diary.unit')}</Text>
            <View style={styles.unitSelector}>
              {calculatorUnits.map((availableUnit) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: unit === availableUnit }}
                  key={availableUnit}
                  onPress={() => setUnit(availableUnit)}
                  style={[
                    styles.unitButton,
                    unit === availableUnit ? styles.selectedUnit : null,
                  ]}
                >
                  <Text style={styles.unitText}>{t(`common.units.${availableUnit}`)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.resultsCard}>
              <Text style={styles.sectionTitle}>{t('diary.livePreview')}</Text>
              <MetricValue
                label={t(product.kind === 'liquid' ? 'diary.milliliters' : 'diary.grams')}
                value={conversion?.ok ? conversion.grams : undefined}
                unit={t(`common.units.${product.kind === 'liquid' ? 'ml' : 'g'}`)}
              />
              <MetricValue
                label={t('diary.calories')}
                value={conversion?.ok ? conversion.kcal : undefined}
                unit={t('common.units.kcal')}
                calories
                emphasis
              />
              {(['protein', 'carbs', 'fat'] as const).map((nutrient) => (
                <MetricValue
                  key={nutrient}
                  label={t(`diary.productFlow.nutrients.${nutrient}`)}
                  value={conversion?.ok ? conversion[nutrient] : undefined}
                  unit={t('common.units.g')}
                />
              ))}
              {(['sugars', 'fiber', 'saturatedFat', 'salt', 'alcohol'] as const)
                .filter((nutrient) => product[nutrient] !== undefined)
                .map((nutrient) => (
                  <MetricValue
                    key={nutrient}
                    label={t(`diary.productFlow.nutrients.${nutrient}`)}
                    value={conversion?.ok ? conversion[nutrient] : undefined}
                    unit={t('common.units.g')}
                  />
                ))}
            </View>

            <View style={styles.equivalentsCard}>
              <Text style={styles.sectionTitle}>{t('diary.productFlow.equivalents')}</Text>
              <View style={styles.equivalentGrid}>
                {equivalentUnits.map((equivalentUnit) => (
                  <Pressable
                    accessibilityRole="button"
                    key={equivalentUnit}
                    onPress={() => {
                      const equivalentQuantity = equivalentValues.get(equivalentUnit);
                      if (equivalentQuantity !== undefined) {
                        setUnit(equivalentUnit);
                        setQuantity(String(equivalentQuantity));
                      }
                    }}
                    style={styles.equivalentTile}
                  >
                    <Text style={styles.equivalentValue}>
                      {formatAmount(equivalentValues.get(equivalentUnit) ?? Number.NaN)}
                    </Text>
                    <Text style={styles.equivalentUnit}>
                      {t(`common.units.${equivalentUnit}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {destination === 'diary' ? (
              <>
                <TextField
                  label={t('buildMeal.date')}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
                <Text style={styles.label}>{t('buildMeal.meal')}</Text>
                <View style={styles.mealSelector}>
                  {MEALS.map((slot) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: meal === slot }}
                      key={slot}
                      onPress={() => setMeal(slot)}
                      style={[styles.mealButton, meal === slot ? styles.selectedUnit : null]}
                    >
                      <Text style={styles.unitText}>{t(`diary.meals.${slot}`)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {submitError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {t(addErrorKey ?? (destination === 'meal' ? 'buildMeal.invalidAmount' : 'diary.saveError'))}
              </Text>
            ) : null}
            <Button
              label={t(
                editingExisting
                  ? 'buildMeal.updateAmount'
                  : duplicate
                    ? 'buildMeal.addAgain'
                    : destination === 'meal'
                      ? 'buildMeal.addToMeal'
                      : 'diary.productFlow.addToDiary',
              )}
              loading={saving}
              onPress={() => void add()}
            />
          </ScrollView>
        </Screen>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.cameraOverlay,
  },
  sheet: {
    maxHeight: '92%',
    paddingBottom: spacing[6],
    backgroundColor: colors.background,
    borderTopLeftRadius: radii[24],
    borderTopRightRadius: radii[24],
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  dragArea: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: radii[12],
    backgroundColor: colors.muted,
  },
  sheetContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  productHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sheetImageFrame: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii[12],
  },
  sheetImage: { width: '100%', height: '100%' },
  productCopy: { flex: 1, gap: spacing[1] },
  productName: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  productBrand: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
  sourceLabel: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.caption },
  nutritionBlock: {
    padding: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  nutritionHeading: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.body },
  metric: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  emphasizedMetric: { minHeight: 60 },
  metricLabel: { flex: 1, color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
  metricValue: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  calorieValue: { fontFamily: fontFamilies.bold, fontSize: typography.title },
  metricUnit: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.caption },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing[4] },
  warning: {
    padding: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.errorSurface,
    borderRadius: radii[12],
  },
  warningText: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  sheetActions: { gap: spacing[2] },
  calculatorContent: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  calculatorHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  calculatorTitle: { flex: 1, color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  headerSpacer: { width: 48 },
  amountCard: {
    padding: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  duplicatePrompt: { gap: spacing[2] },
  duplicateText: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
  label: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  amountRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  amountInput: {
    flex: 1,
    minHeight: 64,
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 36,
    paddingVertical: 0,
  },
  amountUnit: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: typography.heading },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickChip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radii[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickChipText: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  unitSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
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
  unitText: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption, textAlign: 'center' },
  resultsCard: {
    minHeight: 260,
    padding: spacing[3],
    gap: spacing[1],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[16],
  },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.body },
  equivalentsCard: {
    padding: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[16],
  },
  equivalentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  equivalentTile: {
    minWidth: 82,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
  },
  equivalentValue: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.body },
  equivalentUnit: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.caption },
  mealSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  mealButton: {
    minHeight: 48,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  error: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.caption },
});
