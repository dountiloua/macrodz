import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
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
import { PrimaryButton } from '@/components/primary-button';
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
  convertServing,
  getAvailableServingUnits,
  type ServingUnit,
} from '@/features/serving-units';

type ViewMode = 'scanning' | 'loading' | 'product' | 'error' | 'manual_form';

type LastScanState = {
  barcode: string;
  timestamp: number;
};

export default function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ViewMode>('scanning');
  const [torch, setTorch] = useState(false);
  const [lastScan, setLastScan] = useState<LastScanState>({ barcode: '', timestamp: 0 });

  // Lookup state
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [product, setProduct] = useState<ParsedProduct | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorClassification | null>(null);

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
  const [isSavingManual, setIsSavingManual] = useState(false);

  const resetToScanner = () => {
    setProduct(null);
    setErrorInfo(null);
    setMode('scanning');
  };

  const handleProductLoaded = (loadedProduct: ParsedProduct) => {
    setProduct(loadedProduct);
    const available = getAvailableServingUnits(loadedProduct);
    if (loadedProduct.servingQuantityG !== undefined && available.includes('unit')) {
      setSelectedUnit('unit');
      setQuantityInput('1');
    } else {
      setSelectedUnit('g');
      setQuantityInput('100');
    }
    setMode('product');
  };

  const performLookup = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    setCurrentBarcode(trimmed);
    setMode('loading');

    const result = await lookupProduct(trimmed);

    if (result.ok) {
      handleProductLoaded(result.product);
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
    const cleaned = manualBarcodeInput.trim();
    // Validate barcode format (8, 12, or 13 digits)
    if (!/^\d{8}$|^\d{12,13}$/.test(cleaned)) {
      setManualBarcodeError(t('scan.manualModal.invalidBarcode'));
      return;
    }

    setManualBarcodeError(null);
    setManualBarcodeModalVisible(false);
    setManualBarcodeInput('');
    performLookup(cleaned);
  };

  const openManualForm = () => {
    setManualForm({
      barcode: currentBarcode,
      name: '',
      brand: '',
      kcal: '',
      protein: '',
      carbs: '',
      fat: '',
      servingQuantityG: '',
    });
    setFormErrors({});
    setMode('manual_form');
  };

  const handleSaveManualProduct = async () => {
    const validated = validateManualProduct(manualForm);
    if (!validated.ok) {
      setFormErrors(validated.errors);
      return;
    }

    setIsSavingManual(true);
    try {
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
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('scan.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.fallbackContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera-outline" size={48} color="#0f766e" />
          </View>
          <Text style={styles.fallbackTitle}>{t('scan.permission.title')}</Text>
          <Text style={styles.fallbackExplanation}>{t('scan.permission.explanation')}</Text>

          <View style={styles.fallbackActions}>
            <PrimaryButton label={t('scan.permission.grantButton')} onPress={requestPermission} />
            <PrimaryButton
              label={t('scan.permission.manualButton')}
              variant="secondary"
              onPress={() => setManualBarcodeModalVisible(true)}
            />
          </View>
        </View>

        {renderManualBarcodeModal()}
      </SafeAreaView>
    );
  }

  // 2. Loading State
  if (mode === 'loading') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>{t('scan.loading')}</Text>
        <Text style={styles.barcodeSubtext}>#{currentBarcode}</Text>
      </SafeAreaView>
    );
  }

  // 3. Error State
  if (mode === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" onPress={resetToScanner} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
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
              color="#dc2626"
            />
          </View>

          <Text style={styles.fallbackTitle}>
            {errorInfo ? t(errorInfo.messageKey) : t('scan.errors.unknown')}
          </Text>

          {errorInfo?.type === 'NOT_FOUND' && (
            <Text style={styles.fallbackExplanation}>{t('scan.errors.notFoundPrompt')}</Text>
          )}

          <View style={styles.fallbackActions}>
            {errorInfo?.type === 'NOT_FOUND' && (
              <PrimaryButton label={t('scan.errors.addManuallyButton')} onPress={openManualForm} />
            )}

            {errorInfo?.isRetryable && (
              <PrimaryButton
                label={t('scan.errors.tryAgain')}
                onPress={() => performLookup(currentBarcode)}
              />
            )}

            <PrimaryButton
              label={t('scan.errors.scanAnother')}
              variant="secondary"
              onPress={resetToScanner}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Manual Product Entry Form (NOT_FOUND flow)
  if (mode === 'manual_form') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" onPress={resetToScanner} style={styles.iconButton}>
            <Ionicons name="close" size={24} color="#0f172a" />
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

            {/* Product Name */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>{t('scan.manualForm.nameLabel')} *</Text>
              <TextInput
                value={manualForm.name}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, name: text }));
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder={t('scan.manualForm.namePlaceholder')}
                placeholderTextColor="#94a3b8"
                style={[styles.textInput, formErrors.name ? styles.inputError : null]}
              />
              {formErrors.name && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.nameRequired')}</Text>
              )}
            </View>

            {/* Brand */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>{t('scan.manualForm.brandLabel')}</Text>
              <TextInput
                value={manualForm.brand}
                onChangeText={(text) => setManualForm((prev) => ({ ...prev, brand: text }))}
                placeholder={t('scan.manualForm.brandPlaceholder')}
                placeholderTextColor="#94a3b8"
                style={styles.textInput}
              />
            </View>

            {/* Per 100g Nutrition */}
            <Text style={styles.sectionHeading}>{t('scan.manualForm.per100gSection')}</Text>

            {/* Calories */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>{t('scan.manualForm.kcalLabel')} *</Text>
              <TextInput
                value={String(manualForm.kcal)}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, kcal: text }));
                  if (formErrors.kcal) setFormErrors((prev) => ({ ...prev, kcal: undefined }));
                }}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                style={[styles.textInput, formErrors.kcal ? styles.inputError : null]}
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
              <Text style={styles.inputLabel}>{t('scan.manualForm.proteinLabel')} *</Text>
              <TextInput
                value={String(manualForm.protein)}
                onChangeText={(text) => {
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
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                style={[styles.textInput, formErrors.protein ? styles.inputError : null]}
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
              <Text style={styles.inputLabel}>{t('scan.manualForm.carbsLabel')} *</Text>
              <TextInput
                value={String(manualForm.carbs)}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, carbs: text }));
                  if (formErrors.carbs || formErrors.macrosSum) {
                    setFormErrors((prev) => ({ ...prev, carbs: undefined, macrosSum: undefined }));
                  }
                }}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                style={[styles.textInput, formErrors.carbs ? styles.inputError : null]}
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
              <Text style={styles.inputLabel}>{t('scan.manualForm.fatLabel')} *</Text>
              <TextInput
                value={String(manualForm.fat)}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, fat: text }));
                  if (formErrors.fat || formErrors.macrosSum) {
                    setFormErrors((prev) => ({ ...prev, fat: undefined, macrosSum: undefined }));
                  }
                }}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                style={[styles.textInput, formErrors.fat ? styles.inputError : null]}
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
              <Text style={styles.inputLabel}>{t('scan.manualForm.servingQuantityGLabel')}</Text>
              <TextInput
                value={String(manualForm.servingQuantityG ?? '')}
                onChangeText={(text) => {
                  setManualForm((prev) => ({ ...prev, servingQuantityG: text }));
                  if (formErrors.servingQuantityG) {
                    setFormErrors((prev) => ({ ...prev, servingQuantityG: undefined }));
                  }
                }}
                placeholder={t('scan.manualForm.servingQuantityGPlaceholder')}
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                style={[styles.textInput, formErrors.servingQuantityG ? styles.inputError : null]}
              />
              {formErrors.servingQuantityG && (
                <Text style={styles.errorText}>{t('scan.manualForm.errors.invalidNumber')}</Text>
              )}
            </View>

            <View style={styles.formActions}>
              <PrimaryButton
                label={t('scan.manualForm.saveButton')}
                disabled={isSavingManual}
                onPress={handleSaveManualProduct}
              />
              <PrimaryButton
                label={t('scan.manualForm.cancelButton')}
                variant="secondary"
                onPress={resetToScanner}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // 5. Product Screen
  if (mode === 'product' && product) {
    const availableUnits = getAvailableServingUnits(product);
    const parsedQuantity = parseFloat(quantityInput.replace(',', '.'));
    const isValidQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
    const conversion = isValidQuantity
      ? convertServing(product, parsedQuantity, selectedUnit)
      : null;

    const kcalUnit = t('common.units.kcal');
    const gUnit = t('common.units.g');

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" onPress={resetToScanner} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('scan.product.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.productContent}>
          {/* Attributions & Badges */}
          <View style={styles.badgeRow}>
            {product.source === 'user' ? (
              <View style={[styles.badge, styles.userBadge]}>
                <Ionicons name="person-outline" size={13} color="#0369a1" />
                <Text style={styles.userBadgeText}>
                  {t('scan.product.userContributedAttribution')}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.offBadge]}>
                <Ionicons name="globe-outline" size={13} color="#0f766e" />
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
          </View>

          {/* Per 100g Macros Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('scan.product.per100gHeading')}</Text>
            <View style={styles.card}>
              <MetricRow
                label={t('scan.product.calories')}
                value={`${product.kcal} ${kcalUnit}`}
                highlight
              />
              <MetricRow label={t('scan.product.protein')} value={`${product.protein} ${gUnit}`} />
              <MetricRow label={t('scan.product.carbs')} value={`${product.carbs} ${gUnit}`} />
              <MetricRow label={t('scan.product.fat')} value={`${product.fat} ${gUnit}`} />
            </View>
          </View>

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
                  placeholderTextColor="#94a3b8"
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
            <PrimaryButton
              label={t('scan.product.addToDiary')}
              onPress={() => Alert.alert(t('common.appName'), t('scan.product.comingSoon'))}
            />
            <PrimaryButton
              label={t('scan.product.scanAnother')}
              variant="secondary"
              onPress={resetToScanner}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
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
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>

          <Text style={styles.cameraTitle}>{t('scan.title')}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setTorch((prev) => !prev)}
            style={[styles.cameraIconButton, torch ? styles.torchActive : null]}
          >
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={24} color="#ffffff" />
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
          <Ionicons name="keypad-outline" size={20} color="#0f172a" />
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
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={13}
              style={[styles.textInput, manualBarcodeError ? styles.inputError : null]}
              autoFocus
            />

            {Boolean(manualBarcodeError) && (
              <Text style={styles.errorText}>{manualBarcodeError}</Text>
            )}

            <View style={styles.modalActions}>
              <PrimaryButton
                label={t('scan.manualModal.submit')}
                onPress={handleManualBarcodeSubmit}
              />
              <PrimaryButton
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
    backgroundColor: '#f8fafc',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 12,
  },
  barcodeSubtext: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchActive: {
    backgroundColor: '#0f766e',
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
    borderColor: '#ffffff',
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
    marginTop: 24,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 24,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  manualEntryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  fallbackContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorIconCircle: {
    backgroundColor: '#fee2e2',
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  fallbackExplanation: {
    fontSize: 15,
    color: '#64748b',
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  offBadge: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  offBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f766e',
  },
  userBadge: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  userBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
  },
  dzBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  dzBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  productHeader: {
    gap: 4,
  },
  productName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  productBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f766e',
  },
  barcodeLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
  },
  calculatedCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    marginTop: 12,
  },
  portionRow: {
    gap: 12,
  },
  quantityCol: {
    gap: 6,
  },
  unitCol: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  quantityInput: {
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  unitScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  unitPillActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  unitPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  unitPillTextActive: {
    color: '#ffffff',
  },
  invalidQuantityText: {
    fontSize: 14,
    color: '#dc2626',
    marginTop: 6,
  },
  productActions: {
    gap: 12,
    marginTop: 12,
  },
  keyboardContainer: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f766e',
    marginTop: 8,
  },
  formGroup: {
    gap: 6,
  },
  textInput: {
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
  formActions: {
    gap: 12,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  modalActions: {
    gap: 10,
    marginTop: 8,
  },
});
