import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { GENERIC_FOODS, searchGenericFoods } from '@/features/generic-foods';
import {
  hasUsableNutrition,
  readSingleParam,
  toLocalDateString,
  type DiaryFood,
  type Meal,
} from '@/features/diary';
import { diaryFoodHistoryQueryKey, diaryQueryKey } from '@/features/diary/queries';
import { shouldAcceptBarcode, validateManualProduct } from '@/features/food-lookup';
import type { ParsedProduct } from '@/features/food-lookup';
import {
  buildMealStore,
  MAX_BUILD_MEAL_ITEMS,
  scanBuildMealProduct,
  saveBuildMealAndClear,
} from '@/features/build-meal';
import type { BuildMealItem, BuildMealTotals } from '@/features/build-meal';
import { MEALS } from '@/features/diary/types';
import {
  convertServing,
  getAvailableServingUnits,
  type ServingUnit,
} from '@/features/serving-units';
import { useAuthStore } from '@/store/auth-store';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type Amount = { quantity: string; unit: ServingUnit };
type BuildMealErrorKey =
  | 'buildMeal.limitReached'
  | 'buildMeal.invalidAmount'
  | 'buildMeal.lookupError'
  | 'buildMeal.manualInvalid'
  | 'buildMeal.saveError'
  | 'diary.nutritionMissing';
type ManualValues = {
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  kind: 'solid' | 'liquid';
};

const EMPTY_MANUAL: ManualValues = {
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  kind: 'solid',
};

function isMeal(value: string): value is Meal {
  return (MEALS as readonly string[]).includes(value);
}

function hasNutrition(food: DiaryFood): boolean {
  return (
    hasUsableNutrition(food) &&
    [food.kcal, food.protein, food.carbs, food.fat].some((value) => value > 0)
  );
}

function getDefaultAmount(product: DiaryFood): Amount {
  const unit: ServingUnit = product.kind === 'liquid' ? 'ml' : 'g';
  return {
    quantity:
      product.servingQuantityG !== undefined && product.servingQuantityG > 0
        ? String(product.servingQuantityG)
        : '100',
    unit,
  };
}

function toBasketItem(
  food: DiaryFood,
  amount: Amount,
  extras: Pick<BuildMealItem, 'barcode' | 'imageUrl'> = {},
): BuildMealItem {
  return {
    ...food,
    ...extras,
    id: randomUUID(),
    quantity: Number(amount.quantity.replace(',', '.')),
    unit: amount.unit,
  };
}

export default function BuildMealScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const user = useAuthStore((state) => state.user);
  const items = useStore(buildMealStore, (state) => state.items);
  const totals = useStore(buildMealStore, (state) => state.totals());
  const [permission, requestPermission] = useCameraPermissions();
  const [pendingProduct, setPendingProduct] = useState<ParsedProduct | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [existingItemId, setExistingItemId] = useState<string | null>(null);
  const [amount, setAmount] = useState<Amount>({ quantity: '100', unit: 'g' });
  const [basketOpen, setBasketOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualValues, setManualValues] = useState<ManualValues>(EMPTY_MANUAL);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<BuildMealErrorKey | null>(null);
  const [date, setDate] = useState(() => {
    const requested = readSingleParam(params.date);
    return requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : toLocalDateString(new Date());
  });
  const mealParam = readSingleParam(params.meal) ?? '';
  const [meal, setMeal] = useState<Meal>(isMeal(mealParam) ? mealParam : 'snack');
  const [savedTotals, setSavedTotals] = useState<BuildMealTotals | null>(null);
  const lastScans = useRef(new Map<string, number>());
  const busyRef = useRef(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const language = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const genericFoods = useMemo(() => searchGenericFoods(search), [search]);

  const resetScanSheet = () => {
    setPendingProduct(null);
    setPendingBarcode('');
    setExistingItemId(null);
    setChangeExistingAmount(false);
    setErrorKey(null);
  };

  async function onBarcodeScanned(barcode: string) {
    const now = Date.now();
    const normalized = barcode.trim();
    for (const [scannedBarcode, timestamp] of lastScans.current) {
      if (now - timestamp >= 2000) lastScans.current.delete(scannedBarcode);
    }
    if (
      busyRef.current ||
      pendingProduct ||
      pendingBarcode ||
      !shouldAcceptBarcode(normalized, lastScans.current.get(normalized) ?? 0, normalized, now)
    ) {
      return;
    }

    lastScans.current.set(normalized, now);
    busyRef.current = true;
    setLookupBusy(true);
    setErrorKey(null);
    try {
      const result = await scanBuildMealProduct(barcode);
      if (!result.ok && result.reason === 'lookup-error') {
        setPendingBarcode(normalized);
        setErrorKey('buildMeal.lookupError');
        return;
      }

      const product = result.product;
      const food: DiaryFood = {
        kind: product.kind,
        name: product.name,
        kcal: product.kcal,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        servingQuantityG: product.servingQuantityG,
        densityGPerMl: product.densityGPerMl,
      };
      setPendingProduct(product);
      setPendingBarcode(product.barcode);
      setAmount(getDefaultAmount(food));
      const existing = buildMealStore
        .getState()
        .items.find((item) => item.barcode === product.barcode);
      setExistingItemId(existing?.id ?? null);
      if (!result.ok) setErrorKey('diary.nutritionMissing');
    } catch {
      setErrorKey('buildMeal.lookupError');
    } finally {
      busyRef.current = false;
      setLookupBusy(false);
    }
  }

  function showLimitIfNeeded(result: 'added' | 'duplicate' | 'limit') {
    if (result === 'limit') setErrorKey('buildMeal.limitReached');
  }

  function addScannedProduct() {
    if (!pendingProduct) return;
    const food: DiaryFood = {
      kind: pendingProduct.kind,
      name: pendingProduct.name,
      kcal: pendingProduct.kcal,
      protein: pendingProduct.protein,
      carbs: pendingProduct.carbs,
      fat: pendingProduct.fat,
      servingQuantityG: pendingProduct.servingQuantityG,
      densityGPerMl: pendingProduct.densityGPerMl,
    };
    if (!hasNutrition(food)) {
      setErrorKey('diary.nutritionMissing');
      return;
    }
    if (!Number.isFinite(Number(amount.quantity.replace(',', '.')))) {
      setErrorKey('buildMeal.invalidAmount');
      return;
    }
    if (
      Number(amount.quantity.replace(',', '.')) <= 0 ||
      Number(amount.quantity.replace(',', '.')) > 10_000 ||
      !getAvailableServingUnits(pendingProduct, pendingProduct.name).includes(amount.unit)
    ) {
      setErrorKey('buildMeal.invalidAmount');
      return;
    }

    const existing = existingItemId
      ? buildMealStore.getState().items.find((item) => item.id === existingItemId)
      : undefined;
    if (existing && changeExistingAmount) {
      buildMealStore.getState().updateItem(existing.id, {
        quantity: Number(amount.quantity.replace(',', '.')),
        unit: amount.unit,
      });
    } else {
      const addResult = buildMealStore.getState().addItem(
        toBasketItem(food, amount, {
          barcode: pendingProduct.barcode,
          imageUrl: pendingProduct.imageUrl,
        }),
      );
      showLimitIfNeeded(addResult);
      if (addResult === 'limit') return;
    }
    setChangeExistingAmount(false);
    resetScanSheet();
  }

  const [changeExistingAmount, setChangeExistingAmount] = useState(false);

  function addGenericFood(food: (typeof GENERIC_FOODS)[number]) {
    setErrorKey(null);
    const product: DiaryFood = {
      kind: food.kind,
      name: food.names[language],
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      servingQuantityG: food.servingQuantityG,
    };
    if (!hasNutrition(product)) {
      setErrorKey('diary.nutritionMissing');
      return;
    }
    showLimitIfNeeded(
      buildMealStore.getState().addItem(toBasketItem(product, getDefaultAmount(product))),
    );
    setSearchOpen(false);
    setBasketOpen(true);
    setSearch('');
  }

  function addManualFood() {
    const validation = validateManualProduct({
      barcode: pendingBarcode,
      name: manualValues.name,
      kcal: manualValues.kcal,
      protein: manualValues.protein,
      carbs: manualValues.carbs,
      fat: manualValues.fat,
      kind: manualValues.kind,
    });
    if (!validation.ok) {
      setErrorKey('buildMeal.manualInvalid');
      return;
    }
    if (!hasNutrition(validation.product)) {
      setErrorKey('diary.nutritionMissing');
      return;
    }
    const food: DiaryFood = {
      kind: validation.product.kind,
      name: validation.product.name,
      kcal: validation.product.kcal,
      protein: validation.product.protein,
      carbs: validation.product.carbs,
      fat: validation.product.fat,
    };
    const result = buildMealStore
      .getState()
      .addItem(
        toBasketItem(food, getDefaultAmount(food), { barcode: pendingBarcode || undefined }),
      );
    if (result === 'limit') {
      setErrorKey('buildMeal.limitReached');
      return;
    }
    setManualOpen(false);
    setBasketOpen(true);
    resetScanSheet();
    setManualValues(EMPTY_MANUAL);
  }

  async function saveMeal() {
    if (!user || items.length === 0) return;
    setSaveBusy(true);
    setErrorKey(null);
    const summary = totals;
    try {
      await saveBuildMealAndClear({ userId: user.id, date, meal }, buildMealStore);
      setSavedTotals(summary);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: diaryQueryKey(user.id, date) }),
        queryClient.invalidateQueries({ queryKey: diaryFoodHistoryQueryKey(user.id, date) }),
      ]).catch((error: unknown) => {
        console.warn('Unable to refresh diary queries after saving a meal.', error);
      });
    } catch {
      setErrorKey('buildMeal.saveError');
    } finally {
      setSaveBusy(false);
    }
  }

  if (savedTotals) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('buildMeal.savedTitle')}</Text>
          <Text style={styles.copy}>
            {t('buildMeal.savedTotals', {
              kcal: Math.round(savedTotals.kcal),
              protein: savedTotals.protein.toFixed(1),
              carbs: savedTotals.carbs.toFixed(1),
              fat: savedTotals.fat.toFixed(1),
            })}
          </Text>
          <Button
            label={t('buildMeal.returnToDiary')}
            onPress={() => router.replace('/(tabs)/diary')}
          />
        </View>
      </Screen>
    );
  }

  if (basketOpen || searchOpen || manualOpen) {
    return (
      <Screen style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Button
            label={t('common.back')}
            variant="secondary"
            onPress={() => {
              setBasketOpen(false);
              setSearchOpen(false);
              setManualOpen(false);
            }}
          />
          {basketOpen ? (
            <>
              <Text style={styles.title}>
                {t('buildMeal.basketTitle', { count: items.length })}
              </Text>
              <TextField
                label={t('buildMeal.date')}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              <Text style={styles.label}>{t('buildMeal.meal')}</Text>
              <View style={styles.wrapRow}>
                {MEALS.map((slot) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: meal === slot }}
                    key={slot}
                    onPress={() => setMeal(slot)}
                    style={[styles.choice, meal === slot ? styles.selectedChoice : null]}
                  >
                    <Text style={styles.choiceText}>{t(`diary.meals.${slot}`)}</Text>
                  </Pressable>
                ))}
              </View>
              {items.map((item) => {
                const units = getAvailableServingUnits(item, item.name);
                const conversion = convertServing(item, item.quantity, item.unit);
                return (
                  <View key={item.id} style={styles.basketItem}>
                    <View style={styles.itemHeading}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          contentFit="contain"
                          style={styles.thumbnail}
                        />
                      ) : null}
                      <Text style={styles.foodName}>{item.name}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('buildMeal.removeItem', { name: item.name })}
                        onPress={() => buildMealStore.getState().removeItem(item.id)}
                        style={styles.iconTarget}
                      >
                        <Ionicons name="trash-outline" size={22} color={colors.error} />
                      </Pressable>
                    </View>
                    <TextInput
                      accessibilityLabel={t('buildMeal.amount')}
                      keyboardType="decimal-pad"
                      value={quantityDrafts[item.id] ?? String(item.quantity)}
                      onChangeText={(text) => {
                        setQuantityDrafts((drafts) => ({ ...drafts, [item.id]: text }));
                        const next = Number(text.replace(',', '.'));
                        if (Number.isFinite(next) && next > 0) {
                          buildMealStore.getState().updateItem(item.id, {
                            quantity: next,
                            unit: item.unit,
                          });
                        }
                      }}
                      onEndEditing={() =>
                        setQuantityDrafts((drafts) => {
                          const { [item.id]: _draft, ...remaining } = drafts;
                          return remaining;
                        })
                      }
                      style={styles.quantityInput}
                    />
                    <View style={styles.wrapRow}>
                      {units.map((unit) => (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ selected: item.unit === unit }}
                          key={unit}
                          onPress={() =>
                            buildMealStore.getState().updateItem(item.id, {
                              quantity: item.quantity,
                              unit,
                            })
                          }
                          style={[styles.choice, item.unit === unit ? styles.selectedChoice : null]}
                        >
                          <Text style={styles.choiceText}>{t(`common.units.${unit}`)}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {conversion?.ok ? (
                      <Text style={styles.copy}>
                        {t('buildMeal.itemCalories', { kcal: conversion.kcal })}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
              {items.length >= MAX_BUILD_MEAL_ITEMS ? (
                <Text style={styles.error}>{t('buildMeal.limitReached')}</Text>
              ) : null}
              {errorKey ? (
                <Text style={styles.error}>{t(errorKey)}</Text>
              ) : null}
              <Button
                label={t('buildMeal.addBySearch')}
                variant="secondary"
                disabled={items.length >= MAX_BUILD_MEAL_ITEMS}
                onPress={() => {
                  setBasketOpen(false);
                  setSearchOpen(true);
                }}
              />
              <Button
                label={t('buildMeal.addManually')}
                variant="secondary"
                disabled={items.length >= MAX_BUILD_MEAL_ITEMS}
                onPress={() => {
                  setBasketOpen(false);
                  setPendingBarcode('');
                  setManualValues(EMPTY_MANUAL);
                  setManualOpen(true);
                }}
              />
              <Button
                label={t('buildMeal.clear')}
                variant="secondary"
                disabled={items.length === 0}
                onPress={() =>
                  Alert.alert(t('buildMeal.clearTitle'), t('buildMeal.clearConfirm'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('buildMeal.clear'),
                      style: 'destructive',
                      onPress: () => buildMealStore.getState().clear(),
                    },
                  ])
                }
              />
              {errorKey === 'buildMeal.saveError' ? (
                <Button
                  label={t('buildMeal.retry')}
                  loading={saveBusy}
                  onPress={() => void saveMeal()}
                />
              ) : (
                <Button
                  label={t('buildMeal.save')}
                  loading={saveBusy}
                  disabled={items.length === 0 || !user}
                  onPress={() => void saveMeal()}
                />
              )}
            </>
          ) : null}

          {searchOpen ? (
            <>
              <Text style={styles.title}>{t('buildMeal.searchTitle')}</Text>
              <TextField
                label={t('diary.searchLabel')}
                value={search}
                onChangeText={setSearch}
                placeholder={t('diary.searchPlaceholder')}
                autoCapitalize="none"
              />
              {genericFoods.map((food) => (
                <Pressable
                  accessibilityRole="button"
                  key={food.id}
                  onPress={() => addGenericFood(food)}
                  style={styles.foodRow}
                >
                  <Text style={styles.foodName}>{food.names[language]}</Text>
                  <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
                </Pressable>
              ))}
              {errorKey ? (
                <Text style={styles.error}>
                  {t(errorKey)}
                </Text>
              ) : null}
              {errorKey === 'diary.nutritionMissing' ? (
                <Button
                  label={t('buildMeal.addManually')}
                  variant="secondary"
                  onPress={() => {
                    setSearchOpen(false);
                    setManualOpen(true);
                  }}
                />
              ) : null}
            </>
          ) : null}

          {manualOpen ? (
            <>
              <Text style={styles.title}>{t('buildMeal.manualTitle')}</Text>
              <TextField
                label={t('scan.manualForm.nameLabel')}
                value={manualValues.name}
                onChangeText={(name) => setManualValues((v) => ({ ...v, name }))}
              />
              <Text style={styles.label}>{t('scan.manualForm.productKindLabel')}</Text>
              <Text style={styles.copy}>
                {t(
                  manualValues.kind === 'liquid'
                    ? 'scan.manualForm.per100mlSection'
                    : 'scan.manualForm.per100gSection',
                )}
              </Text>
              <View style={styles.wrapRow}>
                {(['solid', 'liquid'] as const).map((kind) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: manualValues.kind === kind }}
                    key={kind}
                    onPress={() => setManualValues((v) => ({ ...v, kind }))}
                    style={[
                      styles.choice,
                      manualValues.kind === kind ? styles.selectedChoice : null,
                    ]}
                  >
                    <Text style={styles.choiceText}>{t(`scan.manualForm.${kind}`)}</Text>
                  </Pressable>
                ))}
              </View>
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((field) => (
                <TextField
                  key={field}
                  label={t(
                    `scan.manualForm.${field === 'kcal' ? 'kcalLabel' : field === 'protein' ? 'proteinLabel' : field === 'carbs' ? 'carbsLabel' : 'fatLabel'}`,
                  )}
                  value={manualValues[field]}
                  onChangeText={(value) => setManualValues((v) => ({ ...v, [field]: value }))}
                  keyboardType="decimal-pad"
                />
              ))}
              {errorKey ? (
                <Text style={styles.error}>
                  {t(errorKey)}
                </Text>
              ) : null}
              <Button label={t('buildMeal.addToMeal')} onPress={addManualFood} />
            </>
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  if (permission && !permission.granted) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('buildMeal.cameraPermission')}</Text>
          <Button label={t('buildMeal.allowCamera')} onPress={() => void requestPermission()} />
          <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
        onBarcodeScanned={({ data }) => void onBarcodeScanned(data)}
      />
      <View style={styles.cameraHeader}>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        <Text style={styles.cameraTitle}>{t('buildMeal.title')}</Text>
      </View>
      {lookupBusy ? <Text style={styles.cameraStatus}>{t('buildMeal.lookupBusy')}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setBasketOpen(true)}
        style={styles.basketBar}
      >
        <View>
          <Text style={styles.basketTitle}>
            {t('buildMeal.basketCount', { count: items.length })}
          </Text>
          <Text style={styles.basketSummary}>
            {t('buildMeal.runningTotals', {
              kcal: Math.round(totals.kcal),
              protein: totals.protein.toFixed(1),
              carbs: totals.carbs.toFixed(1),
              fat: totals.fat.toFixed(1),
            })}
          </Text>
        </View>
        <Ionicons name="chevron-up" size={24} color={colors.text} />
      </Pressable>
      {pendingProduct || pendingBarcode ? (
        <View style={styles.bottomSheet}>
          {pendingProduct?.imageUrl ? (
            <Image
              source={{ uri: pendingProduct.imageUrl }}
              contentFit="contain"
              style={styles.productImage}
            />
          ) : null}
          <Text style={styles.sheetTitle}>{pendingProduct?.name ?? pendingBarcode}</Text>
          {errorKey ? (
            <Text style={styles.error}>{t(errorKey)}</Text>
          ) : null}
          {pendingProduct && hasNutrition(pendingProduct) ? (
            <>
              {existingItemId && !changeExistingAmount ? (
                <Text style={styles.copy}>{t('buildMeal.duplicatePrompt')}</Text>
              ) : null}
              <TextInput
                accessibilityLabel={t('buildMeal.amount')}
                keyboardType="decimal-pad"
                value={amount.quantity}
                onChangeText={(quantity) => setAmount((current) => ({ ...current, quantity }))}
                style={styles.quantityInput}
              />
              <View style={styles.wrapRow}>
                {getAvailableServingUnits(pendingProduct, pendingProduct.name).map((unit) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: amount.unit === unit }}
                    key={unit}
                    onPress={() => setAmount((current) => ({ ...current, unit }))}
                    style={[styles.choice, amount.unit === unit ? styles.selectedChoice : null]}
                  >
                    <Text style={styles.choiceText}>{t(`common.units.${unit}`)}</Text>
                  </Pressable>
                ))}
              </View>
              {existingItemId && !changeExistingAmount ? (
                <View style={styles.sheetActions}>
                  <Button
                    label={t('buildMeal.addAgain')}
                    onPress={() => {
                      setChangeExistingAmount(false);
                      addScannedProduct();
                    }}
                  />
                  <Button
                    label={t('buildMeal.changeAmount')}
                    variant="secondary"
                    onPress={() => {
                      const existing = items.find((item) => item.id === existingItemId);
                      if (existing)
                        setAmount({ quantity: String(existing.quantity), unit: existing.unit });
                      setChangeExistingAmount(true);
                    }}
                  />
                </View>
              ) : (
                <Button
                  label={t(changeExistingAmount ? 'buildMeal.updateAmount' : 'buildMeal.addToMeal')}
                  disabled={items.length >= MAX_BUILD_MEAL_ITEMS && !changeExistingAmount}
                  onPress={addScannedProduct}
                />
              )}
            </>
          ) : (
            <Button
              label={t('buildMeal.openManualForm')}
              onPress={() => {
                setManualValues(EMPTY_MANUAL);
                setManualOpen(true);
              }}
            />
          )}
          <Button label={t('common.cancel')} variant="secondary" onPress={resetScanSheet} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  cameraRoot: { flex: 1, backgroundColor: colors.background },
  cameraHeader: {
    position: 'absolute',
    top: spacing[8],
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cameraTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  cameraStatus: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    padding: spacing[3],
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radii[12],
  },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  copy: { color: colors.text, fontFamily: fontFamilies.regular, fontSize: typography.body },
  label: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  basketBar: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  basketTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.body },
  basketSummary: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  bottomSheet: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: 92,
    maxHeight: '68%',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii[16],
  },
  productImage: { width: 60, height: 60, alignSelf: 'center' },
  sheetTitle: {
    color: colors.text,
    textAlign: 'center',
    fontFamily: fontFamilies.bold,
    fontSize: typography.heading,
  },
  sheetActions: { gap: spacing[2] },
  quantityInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
    paddingHorizontal: spacing[4],
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
    backgroundColor: colors.background,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  choice: {
    minHeight: 48,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
    backgroundColor: colors.surface,
  },
  selectedChoice: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  choiceText: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.caption },
  basketItem: {
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
  },
  itemHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  thumbnail: { width: 40, height: 40 },
  foodName: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
  },
  iconTarget: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  foodRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii[12],
  },
  error: { color: colors.error, fontFamily: fontFamilies.medium, fontSize: typography.caption },
});
