import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetricRow } from '@/components/metric-row';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import {
  classifyLookupError,
  lookupProduct,
  saveManualProduct,
  shouldAcceptBarcode,
  validateManualProduct,
  type ErrorClassification,
  type ManualProductInput,
  type ManualProductValidationErrors,
  type ParsedProduct,
} from '@/features/food-lookup';
import {
  buildManualProductForm,
  getInitialServingSelection,
  normalizeManualBarcode,
} from '@/features/food-lookup/scan-handlers';
import {
  buildLogFoodParams,
  findProductIdByBarcode,
  getNutritionPer100g,
  insertUserProduct,
  hasUsableNutrition,
  readSingleParam,
  toLocalDateString,
  type Meal,
} from '@/features/diary';
import { MEALS } from '@/features/diary/types';
import { useAuthStore } from '@/store/auth-store';
import {
  convertServing,
  getAvailableServingUnits,
  getProductDensityGPerMl,
  isVolumeServingUnit,
  type ServingUnit,
} from '@/features/serving-units';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

type ViewMode = 'scanning' | 'loading' | 'product' | 'error' | 'manual_form';

type LastScanState = {
  barcode: string;
  timestamp: number;
};

export default function ScanFlow() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ diary?: string; date?: string; meal?: string }>();
  const diaryFlow = readSingleParam(params.diary) === 'true';
  const logDate = readSingleParam(params.date) ?? toLocalDateString(new Date());
  const mealParam = readSingleParam(params.meal);
  const meal: Meal =
    mealParam && (MEALS as readonly string[]).includes(mealParam) ? (mealParam as Meal) : 'snack';
  const user = useAuthStore((state) => state.user);
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ViewMode>('scanning');
  const [torch, setTorch] = useState(false);
  const [lastScan, setLastScan] = useState<LastScanState>({ barcode: '', timestamp: 0 });

  // Lookup state
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [product, setProduct] = useState<ParsedProduct | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorClassification | null>(null);
  const [productIdLookupFailed, setProductIdLookupFailed] = useState(false);

  // Manual barcode modal
  const [manualBarcodeModalVisible, setManualBarcodeModalVisible] = useState(false);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [manualBarcodeError, setManualBarcodeError] = useState<string | null>(null);

  // Portion calculator state
  const [quantityInput, setQuantityInput] = useState('100');
  const [selectedUnit, setSelectedUnit] = useState<ServingUnit>('g');

  // Manual product form state
  const [manualForm, setManualForm] = useState<ManualProductInput>({
    barcode: '',
    name: '',
    brand: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    servingQuantityG: '',
  });
  const [formErrors, setFormErrors] = useState<ManualProductValidationErrors>({});
  const [manualNutritionError, setManualNutritionError] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);

  const resetToScanner = () => {
    setProduct(null);
    setErrorInfo(null);
    setMode('scanning');
  };

  const handleProductLoaded = (loadedProduct: ParsedProduct, productId?: string) => {
    setProduct(loadedProduct);
    setImageFailed(false);
    if (diaryFlow && hasUsableNutrition(loadedProduct)) {
      router.replace({
        pathname: '/log-food',
        params: buildLogFoodParams(logDate, meal, {
          name: loadedProduct.name,
          kcal: loadedProduct.kcal,
          protein: loadedProduct.protein,
          carbs: loadedProduct.carbs,
          fat: loadedProduct.fat,
          servingQuantityG: loadedProduct.servingQuantityG,
          densityGPerMl: loadedProduct.densityGPerMl,
          productId,
        }),
      });
      return;
    }
    const available = getAvailableServingUnits(loadedProduct, loadedProduct.name);
    const initialSelection = getInitialServingSelection(loadedProduct, available);
    setSelectedUnit(initialSelection.unit);
    setQuantityInput(initialSelection.quantity);
    setMode('product');
  };

  const performLookup = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    setCurrentBarcode(trimmed);
    setMode('loading');
    setProductIdLookupFailed(false);

    const result = await lookupProduct(trimmed);

    if (result.ok) {
      if (diaryFlow) {
        try {
          const productId = await findProductIdByBarcode(result.product.barcode);
          handleProductLoaded(result.product, productId);
        } catch {
          setProductIdLookupFailed(true);
          setMode('error');
        }
      } else {
        handleProductLoaded(result.product);
      }
    } else {
      const classified = classifyLookupError(result.error);
      setErrorInfo(classified);
      setMode('error');
    }
  };

  const onBarcodeScanned = (scannedData: string) => {
    if (mode !== 'scanning') return;

    const now = Date.now();
    const canScan = shouldAcceptBarcode(
      lastScan.barcode || null,
      lastScan.timestamp,
      scannedData,
      now,
    );

    if (!canScan) return;

    setLastScan({ barcode: scannedData.trim(), timestamp: now });
    performLookup(scannedData);
  };

  const handleManualBarcodeSubmit = () => {
    const result = normalizeManualBarcode(manualBarcodeInput);
    if (!result.ok) {
      setManualBarcodeError(t(classifyLookupError(result.error).messageKey));
      return;
    }

    setManualBarcodeError(null);
    setManualBarcodeModalVisible(false);
    setManualBarcodeInput('');
    performLookup(result.barcode);
  };

  const openManualForm = (existingProduct?: ParsedProduct) => {
    setManualForm(buildManualProductForm(currentBarcode, existingProduct));
    setFormErrors({});
    setManualNutritionError(false);
    setMode('manual_form');
  };

  const handleSaveManualProduct = async () => {
    const validated = validateManualProduct(manualForm);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }
    if (!hasUsableNutrition(validated.product)) {
      setManualNutritionError(true);
      return;
    }

    setIsSavingManual(true);
    try {
      if (diaryFlow) {
        if (!user) {
          Alert.alert(t('common.appName'), t('diary.saveError'));
          return;
        }

        const product = validated.product;
        const productId = await insertUserProduct(user.id, {
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          kcal: product.kcal,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          servingQuantityG: product.servingQuantityG,
          densityGPerMl: product.densityGPerMl,
        });
        router.replace({
          pathname: '/log-food',
          params: buildLogFoodParams(logDate, meal, {
            name: product.name,
            kcal: product.kcal,
            protein: product.protein,
            carbs: product.carbs,
            fat: product.fat,
            servingQuantityG: product.servingQuantityG,
            productId,
          }),
        });
        return;
      }

      await saveManualProduct(validated.product);
      handleProductLoaded(validated.product);
    } catch {
      Alert.alert(t('common.appName'), t('scan.errors.unknown'));
    } finally {
      setIsSavingManual(false);
    }
  };

  // 1. Permission Fallback Screen
  if (!permission) {
    return (
      <Screen padding={spacing[6]} style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen padding={0} style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('scan.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.fallbackContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera-outline" size={48} color={colors.accent} />
          </View>
          <Text style={styles.fallbackTitle}>{t('scan.permission.title')}</Text>
          <Text style={styles.fallbackExplanation}>{t('scan.permission.explanation')}</Text>

          <View style={styles.fallbackActions}>
            <Button label={t('scan.permission.grantButton')} onPress={requestPermission} />
            <Button
              label={t('scan.permission.manualButton')}
              variant="secondary"
              onPress={() => setManualBarcodeModalVisible(true)}
            />
          </View>
        </View>

        {renderManualBarcodeModal()}
      </Screen>
    );
  }

  // 2. Loading State
  if (mode === 'loading') {
    return (
      <Screen padding={spacing[6]} style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>{t('scan.loading')}</Text>
        <Text style={styles.barcodeSubtext}>#{currentBarcode}</Text>
      </Screen>
    );
  }

  // 3. Error State
  if (mode === 'error') {
    return (
      <Screen padding={0} style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" onPress={resetToScanner} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('scan.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.fallbackContent}>
          <View style={[styles.iconCircle, styles.errorIconCircle]}>
            <Ionicons
              name={
                errorInfo?.type === 'NO_INTERNET' ? 'cloud-offline-outline' : 'alert-circle-outline'
              }
              size={48}
              color={colors.error}
            />
          </View>

          <Text style={styles.fallbackTitle}>
            {productIdLookupFailed
              ? t('diary.loadError')
              : errorInfo
                ? t(errorInfo.messageKey)
                : t('scan.errors.unknown')}
          </Text>

          {(errorInfo?.type === 'NOT_FOUND' || errorInfo?.type === 'INVALID_DATA') && (
            <Text style={styles.fallbackExplanation}>{t('scan.errors.notFoundPrompt')}</Text>
          )}
          {errorInfo?.type === 'INVALID_DATA' ? (
            <Text style={styles.fallbackExplanation}>{t('diary.nutritionMissing')}</Text>
          ) : null}

          <View style={styles.fallbackActions}>
            {(errorInfo?.type === 'NOT_FOUND' || errorInfo?.type === 'INVALID_DATA') && (
              <Button label={t('scan.errors.addManuallyButton')} onPress={() => openManualForm()} />
            )}

            {(productIdLookupFailed || errorInfo?.isRetryable) && (
              <Button
                label={t('scan.errors.tryAgain')}
                onPress={() => performLookup(currentBarcode)}
              />
            )}

            <Button
              label={t('scan.errors.scanAnother')}
              variant="secondary"
              onPress={resetToScanner}
            />
          </View>
        </View>
      </Screen>
    );
  }

  // 4. Manual Product Entry Form (NOT_FOUND flow)
  if (mode === 'manual_form') {
    return (
      <Screen padding={0} style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" onPress={resetToScanner} style={styles.iconButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('scan.manualForm.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <ScrollView contentContainerStyle={styles.formScrollContent}>
            <Text style={styles.formSubtitle}>
              {t('scan.manualForm.subtitle', { barcode: manualForm.barcode })}
            </Text>
            {manualNutritionError ? (
              <Text style={styles.errorText}>{t('diary.nutritionMissing')}</Text>
            ) : null}

            {/* Product Name */}
            <View style={styles.formGroup}>
              <TextField
                label={`${t('scan.manualForm.nameLabel')} *`}
                value={manualForm.name}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, name: text }));
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder={t('scan.manualForm.namePlaceholder')}
                error={formErrors.name ? t('scan.manualForm.errors.nameRequired') : null}
              />
            </View>

            {/* Brand */}
            <View style={styles.formGroup}>
              <TextField
                label={t('scan.manualForm.brandLabel')}
                value={manualForm.brand ?? ''}
                onChangeText={(text) => setManualForm((prev) => ({ ...prev, brand: text }))}
                placeholder={t('scan.manualForm.brandPlaceholder')}
              />
            </View>

            {/* Per 100g Nutrition */}
            <Text style={styles.sectionHeading}>{t('scan.manualForm.per100gSection')}</Text>

            {/* Calories */}
            <View style={styles.formGroup}>
              <TextField
                label={`${t('scan.manualForm.kcalLabel')} *`}
                value={String(manualForm.kcal)}
                onChangeText={(text) => {
                  setManualNutritionError(false);
                  setManualForm((prev) => ({ ...prev, kcal: text }));
                  if (formErrors.kcal) setFormErrors((prev) => ({ ...prev, kcal: undefined }));
                }}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              {formErrors.kcal === 'REQUIRED' && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.kcalRequired')}</Text>
              )}
              {formErrors.kcal === 'EXCEEDS_MAX' && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.kcalExceedsMax')}</Text>
              )}
              {formErrors.kcal === 'INVALID_NUMBER' && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.invalidNumber')}</Text>
              )}
            </View>

            {/* Protein */}
            <View style={styles.formGroup}>
              <TextField
                label={`${t('scan.manualForm.proteinLabel')} *`}
                value={String(manualForm.protein)}
                onChangeText={(text) => {
                  setManualNutritionError(false);
                  setManualForm((prev) => ({ ...prev, protein: text }));
                  if (formErrors.protein || formErrors.macrosSum) {
                    setFormErrors((prev) => ({
                      ...prev,
                      protein: undefined,
                      macrosSum: undefined,
                    }));
                  }
                }}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              {formErrors.protein && (
                <Text style={styles.errorText}>
                  {formErrors.protein === 'REQUIRED'
                    ? t('scan.manualForm.errors.proteinRequired')
                    : t('scan.manualForm.errors.invalidNumber')}
                </Text>
              )}
            </View>

            {/* Carbs */}
            <View style={styles.formGroup}>
              <TextField
                label={`${t('scan.manualForm.carbsLabel')} *`}
                value={String(manualForm.carbs)}
                onChangeText={(text) => {
                  setManualNutritionError(false);
                  setManualForm((prev) => ({ ...prev, carbs: text }));
                  if (formErrors.carbs || formErrors.macrosSum) {
                    setFormErrors((prev) => ({ ...prev, carbs: undefined, macrosSum: undefined }));
                  }
                }}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              {formErrors.carbs && (
                <Text style={styles.errorText}>
                  {formErrors.carbs === 'REQUIRED'
                    ? t('scan.manualForm.errors.carbsRequired')
                    : t('scan.manualForm.errors.invalidNumber')}
                </Text>
              )}
            </View>

            {/* Fat */}
            <View style={styles.formGroup}>
              <TextField
                label={`${t('scan.manualForm.fatLabel')} *`}
                value={String(manualForm.fat)}
                onChangeText={(text) => {
                  setManualNutritionError(false);
                  setManualForm((prev) => ({ ...prev, fat: text }));
                  if (formErrors.fat || formErrors.macrosSum) {
                    setFormErrors((prev) => ({ ...prev, fat: undefined, macrosSum: undefined }));
                  }
                }}
                placeholder="0"
                keyboardType="decimal-pad"
              />
              {formErrors.fat && (
                <Text style={styles.errorText}>
                  {formErrors.fat === 'REQUIRED'
                    ? t('scan.manualForm.errors.fatRequired')
                    : t('scan.manualForm.errors.invalidNumber')}
                </Text>
              )}
              {formErrors.macrosSum && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.macrosExceed100')}</Text>
              )}
            </View>

            {/* Optional Portion Size */}
            <Text style={styles.sectionHeading}>{t('scan.manualForm.servingSection')}</Text>
            <View style={styles.formGroup}>
              <TextField
                label={t('scan.manualForm.servingQuantityGLabel')}
                value={String(manualForm.servingQuantityG ?? '')}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, servingQuantityG: text }));
                  if (formErrors.servingQuantityG) {
                    setFormErrors((prev) => ({ ...prev, servingQuantityG: undefined }));
                  }
                }}
                placeholder={t('scan.manualForm.servingQuantityGPlaceholder')}
                keyboardType="decimal-pad"
              />
              {formErrors.servingQuantityG && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.invalidNumber')}</Text>
              )}
            </View>

            <View style={styles.formActions}>
              <Button
                label={t('scan.manualForm.saveButton')}
                loading={isSavingManual}
                onPress={handleSaveManualProduct}
              />
              <Button
                label={t('scan.manualForm.cancelButton')}
                variant="secondary"
                onPress={resetToScanner}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // 5. Product Screen
  if (mode === 'product' && product) {
    const nutrition = getNutritionPer100g(product);
    const nutritionUsable = nutrition !== null;
    const availableUnits = getAvailableServingUnits(product, product.name);
    const productForConversion = {
      ...product,
      densityGPerMl: product.densityGPerMl ?? getProductDensityGPerMl(product.name),
    };
    const parsedQuantity = parseFloat(quantityInput.replace(',', '.'));
    const isValidQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
    const conversion =
      nutritionUsable && isValidQuantity
        ? convertServing(productForConversion, parsedQuantity, selectedUnit)
        : null;
    const servingConversion =
      nutritionUsable && product.servingQuantityG !== undefined
        ? convertServing(productForConversion, 1, 'unit')
        : null;

    const kcalUnit = t('common.units.kcal');
    const gUnit = t('common.units.g');
    const fallbackName = `${product.brand ? `${product.brand} ` : ''}${product.barcode}`;
    const isNameMissing = product.name === fallbackName;

    return (
      <Screen padding={0} style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" onPress={resetToScanner} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('scan.product.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.productContent}>
          <View style={styles.productImageFrame}>
            {product.imageUrl && !imageFailed ? (
              <Image
                source={{ uri: product.imageUrl }}
                contentFit="contain"
                cachePolicy="memory-disk"
                onError={() => setImageFailed(true)}
                style={styles.productImage}
                accessibilityLabel={product.name}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color={colors.muted} />
              </View>
            )}
          </View>

          {/* Attributions & Badges */}
          <View style={styles.badgeRow}>
            {product.source === 'user' ? (
              <View style={[styles.badge, styles.userBadge]}>
                <Ionicons name="person-outline" size={13} color={colors.accent} />
                <Text style={styles.userBadgeText}>
                  {t('scan.product.userContributedAttribution')}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.offBadge]}>
                <Ionicons name="globe-outline" size={13} color={colors.accent} />
                <Text style={styles.offBadgeText}>
                  {t('scan.product.openFoodFactsAttribution')}
                </Text>
              </View>
            )}

            {product.isLikelyAlgerian && (
              <View style={[styles.badge, styles.dzBadge]}>
                <Text style={styles.dzBadgeText}>🇩🇿 {t('scan.product.algerianProductBadge')}</Text>
              </View>
            )}
          </View>

          {/* Product Header */}
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            {Boolean(product.brand) && <Text style={styles.productBrand}>{product.brand}</Text>}
            <Text style={styles.barcodeLabel}>#{product.barcode}</Text>
            {isNameMissing ? (
              <View style={styles.missingName}>
                <Text style={styles.missingNameNotice}>{t('scan.product.nameMissing')}</Text>
                <Button
                  label={t('scan.product.addNameManually')}
                  variant="secondary"
                  onPress={() => openManualForm(product)}
                />
              </View>
            ) : null}
          </View>

          {/* Per 100g Macros Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('scan.product.per100gHeading')}</Text>
            {nutrition ? (
              <View style={styles.card}>
                <MetricRow
                  label={t('scan.product.calories')}
                  value={`${nutrition.kcal} ${kcalUnit}`}
                  highlight
                />
                <MetricRow
                  label={t('scan.product.protein')}
                  value={`${nutrition.protein} ${gUnit}`}
                />
                <MetricRow label={t('scan.product.carbs')} value={`${nutrition.carbs} ${gUnit}`} />
                <MetricRow label={t('scan.product.fat')} value={`${nutrition.fat} ${gUnit}`} />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.errorText}>{t('diary.nutritionMissing')}</Text>
                <Button
                  label={t('scan.product.addNutritionManually')}
                  variant="secondary"
                  onPress={() => openManualForm(product)}
                />
              </View>
            )}
          </View>

          {servingConversion?.ok ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('scan.product.perServingHeading')}</Text>
              <View style={styles.card}>
                <MetricRow
                  label={t('scan.product.calories')}
                  value={`${servingConversion.kcal} ${kcalUnit}`}
                  highlight
                />
                <MetricRow
                  label={t('scan.product.protein')}
                  value={`${servingConversion.protein} ${gUnit}`}
                />
                <MetricRow
                  label={t('scan.product.carbs')}
                  value={`${servingConversion.carbs} ${gUnit}`}
                />
                <MetricRow
                  label={t('scan.product.fat')}
                  value={`${servingConversion.fat} ${gUnit}`}
                />
              </View>
            </View>
          ) : null}

          {/* Portion Calculator Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('scan.product.portionHeading')}</Text>

            <View style={styles.portionRow}>
              {/* Quantity */}
              <View style={styles.quantityCol}>
                <Text style={styles.inputLabel}>{t('scan.product.quantityLabel')}</Text>
                <TextInput
                  value={quantityInput}
                  onChangeText={setQuantityInput}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={colors.muted}
                  style={styles.quantityInput}
                />
              </View>

              {/* Unit Selection */}
              <View style={styles.unitCol}>
                <Text style={styles.inputLabel}>{t('scan.product.unitLabel')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.unitScroll}
                >
                  {availableUnits.map((u) => {
                    const isSelected = u === selectedUnit;
                    return (
                      <Pressable
                        key={u}
                        onPress={() => setSelectedUnit(u)}
                        style={[styles.unitPill, isSelected ? styles.unitPillActive : null]}
                      >
                        <Text
                          style={[
                            styles.unitPillText,
                            isSelected ? styles.unitPillTextActive : null,
                          ]}
                        >
                          {t(`common.units.${u}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            {isVolumeServingUnit(selectedUnit) &&
            product.densityGPerMl === undefined &&
            getProductDensityGPerMl(product.name) === undefined ? (
              <Text style={styles.approximateWarning}>{t('diary.approximateVolumeWarning')}</Text>
            ) : null}

            {/* Calculated Values */}
            {conversion && conversion.ok ? (
              <View style={[styles.card, styles.calculatedCard]}>
                <MetricRow
                  label={t('scan.product.gramsTotal')}
                  value={`${conversion.grams} ${gUnit}`}
                />
                <MetricRow
                  label={t('scan.product.calories')}
                  value={`${conversion.kcal} ${kcalUnit}`}
                  highlight
                />
                <MetricRow
                  label={t('scan.product.protein')}
                  value={`${conversion.protein} ${gUnit}`}
                />
                <MetricRow label={t('scan.product.carbs')} value={`${conversion.carbs} ${gUnit}`} />
                <MetricRow label={t('scan.product.fat')} value={`${conversion.fat} ${gUnit}`} />
              </View>
            ) : (
              <Text style={styles.invalidQuantityText}>
                {t('scan.manualForm.errors.invalidNumber')}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.productActions}>
            <Button
              label={t('scan.product.addToDiary')}
              disabled={!nutritionUsable}
              onPress={() =>
                router.push({
                  pathname: '/log-food',
                  params: buildLogFoodParams(toLocalDateString(new Date()), meal, {
                    name: product.name,
                    kcal: product.kcal,
                    protein: product.protein,
                    carbs: product.carbs,
                    fat: product.fat,
                    servingQuantityG: product.servingQuantityG,
                    densityGPerMl: product.densityGPerMl,
                  }),
                })
              }
            />
            <Button
              label={t('scan.product.scanAnother')}
              variant="secondary"
              onPress={resetToScanner}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // 6. Camera Scanner View
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a'],
        }}
        onBarcodeScanned={(result) => onBarcodeScanned(result.data)}
      />

      {/* Top Overlay Bar */}
      <SafeAreaView style={styles.overlayTop} edges={['top']}>
        <View style={styles.cameraHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.cameraIconButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.cameraTitle}>{t('scan.title')}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setTorch((prev) => !prev)}
            style={[styles.cameraIconButton, torch ? styles.torchActive : null]}
          >
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={24} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Viewfinder Target */}
      <View style={styles.viewfinderContainer} pointerEvents="none">
        <View style={styles.viewfinderFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.viewfinderInstruction}>{t('scan.instruction')}</Text>
      </View>

      {/* Bottom Floating Bar */}
      <SafeAreaView style={styles.overlayBottom} edges={['bottom']}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setManualBarcodeModalVisible(true)}
          style={styles.manualEntryButton}
        >
          <Ionicons name="keypad-outline" size={20} color={colors.text} />
          <Text style={styles.manualEntryButtonText}>{t('scan.typeManually')}</Text>
        </Pressable>
      </SafeAreaView>

      {renderManualBarcodeModal()}
    </View>
  );

  function renderManualBarcodeModal() {
    return (
      <Modal
        visible={manualBarcodeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualBarcodeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('scan.manualModal.title')}</Text>
            <Text style={styles.modalSubtitle}>{t('scan.manualModal.subtitle')}</Text>

            <TextInput
              value={manualBarcodeInput}
              onChangeText={(text) => {
                setManualBarcodeInput(text);
                if (manualBarcodeError) setManualBarcodeError(null);
              }}
              placeholder={t('scan.manualModal.placeholder')}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={13}
              style={[styles.textInput, manualBarcodeError ? styles.inputError : null]}
              autoFocus
            />

            {Boolean(manualBarcodeError) && (
              <Text style={styles.errorText}>{manualBarcodeError}</Text>
            )}

            <View style={styles.modalActions}>
              <Button label={t('scan.manualModal.submit')} onPress={handleManualBarcodeSubmit} />
              <Button
                label={t('scan.manualModal.cancel')}
                variant="secondary"
                onPress={() => {
                  setManualBarcodeModalVisible(false);
                  setManualBarcodeError(null);
                  setManualBarcodeInput('');
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.cameraBackground,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing[6],
    gap: spacing[3],
  },
  loadingText: {
    fontSize: typography.heading,
    fontFamily: fontFamilies.medium,
    color: colors.text,
    marginTop: spacing[3],
  },
  barcodeSubtext: {
    fontSize: typography.caption,
    color: colors.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: typography.body,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii[24],
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  cameraTitle: {
    fontSize: typography.body,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    textShadowColor: colors.cameraBackground,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cameraOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchActive: {
    backgroundColor: colors.accent,
  },
  viewfinderContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: 260,
    height: 180,
    borderRadius: 16,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.text,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  viewfinderInstruction: {
    marginTop: spacing[6],
    color: colors.text,
    fontSize: typography.caption,
    fontFamily: fontFamilies.medium,
    backgroundColor: colors.cameraOverlay,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii[24],
    overflow: 'hidden',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: spacing[6],
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radii[24],
    gap: spacing[2],
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: colors.cameraBackground,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  manualEntryButtonText: {
    fontSize: typography.body,
    fontFamily: fontFamilies.medium,
    color: colors.text,
  },
  fallbackContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorIconCircle: {
    backgroundColor: colors.errorSurface,
  },
  fallbackTitle: {
    fontSize: typography.heading,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    textAlign: 'center',
  },
  fallbackExplanation: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  fallbackActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  productContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  productImageFrame: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  missingName: {
    gap: spacing[2],
    marginTop: spacing[2],
  },
  missingNameNotice: {
    color: colors.error,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii[12],
    gap: spacing[1],
  },
  offBadge: {
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  offBadgeText: {
    fontSize: typography.caption,
    fontFamily: fontFamilies.medium,
    color: colors.text,
  },
  userBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBadgeText: {
    fontSize: typography.caption,
    fontFamily: fontFamilies.medium,
    color: colors.text,
  },
  dzBadge: {
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dzBadgeText: {
    fontSize: typography.caption,
    fontFamily: fontFamilies.medium,
    color: colors.text,
  },
  productHeader: {
    gap: spacing[1],
  },
  productName: {
    fontSize: typography.title,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  productBrand: {
    fontSize: typography.body,
    fontFamily: fontFamilies.medium,
    color: colors.accent,
  },
  barcodeLabel: {
    fontSize: typography.caption,
    color: colors.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontFamily: fontFamilies.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
  },
  calculatedCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    marginTop: spacing[3],
  },
  portionRow: {
    gap: spacing[3],
  },
  quantityCol: {
    gap: spacing[2],
  },
  unitCol: {
    gap: spacing[2],
  },
  inputLabel: {
    fontSize: typography.caption,
    fontFamily: fontFamilies.medium,
    color: colors.text,
  },
  quantityInput: {
    minHeight: 54,
    backgroundColor: colors.surface,
    borderRadius: radii[12],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    fontSize: typography.heading,
    fontFamily: fontFamilies.medium,
    color: colors.text,
  },
  unitScroll: {
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  unitPill: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii[24],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  unitPillText: {
    fontSize: typography.caption,
    fontFamily: fontFamilies.medium,
    color: colors.muted,
  },
  unitPillTextActive: {
    color: colors.text,
  },
  invalidQuantityText: {
    fontSize: typography.caption,
    color: colors.error,
    marginTop: spacing[2],
  },
  approximateWarning: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: spacing[2],
  },
  productActions: {
    gap: spacing[3],
    marginTop: spacing[3],
  },
  keyboardContainer: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  formSubtitle: {
    fontSize: typography.caption,
    color: colors.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: spacing[1],
  },
  sectionHeading: {
    fontSize: typography.body,
    fontFamily: fontFamilies.bold,
    color: colors.accent,
    marginTop: spacing[2],
  },
  formGroup: {
    gap: spacing[2],
  },
  textInput: {
    minHeight: 54,
    backgroundColor: colors.surface,
    borderRadius: radii[12],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    fontSize: typography.body,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: typography.caption,
    color: colors.error,
  },
  formActions: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.cameraOverlay,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii[24],
    padding: spacing[6],
    gap: spacing[4],
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: colors.cameraBackground,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: typography.heading,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: typography.caption,
    color: colors.muted,
    lineHeight: 20,
  },
  modalActions: {
    gap: spacing[2],
    marginTop: spacing[2],
  },
});
