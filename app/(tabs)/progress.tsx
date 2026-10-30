import { LineChart } from 'react-native-gifted-charts';
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
  useWindowDimensions,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import {
  calculateMovingAverage,
  calculatePeriodChange,
  calculateWeeklyWeightAverages,
  getGoalDirectionMessage,
  getWeightTrendDirection,
  parseBodyMetricForm,
  useBodyMetricMutations,
  useBodyMetrics,
} from '@/features/body-metrics';
import type { BodyMetricFormValues, BodyMetricValidationCode } from '@/features/body-metrics';
import { toLocalDateString } from '@/features/diary/date';
import { useAuthStore } from '@/store/auth-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

function emptyForm(): BodyMetricFormValues {
  return {
    entry_date: toLocalDateString(new Date()),
    weight_kg: '',
    chest_cm: '',
    waist_cm: '',
    arms_cm: '',
    thighs_cm: '',
  };
}

function displayDate(value: string, language: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(language, options).format(new Date(year, month - 1, day, 12));
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateDiffDays(start: string, end: string): number {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

export default function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const profileGoal = useProfileStore((state) => state.profile?.goal ?? 'maintain');
  const metricsQuery = useBodyMetrics(user?.id);
  const mutations = useBodyMetricMutations(user?.id ?? '');
  const { width: screenWidth } = useWindowDimensions();
  const [form, setForm] = useState<BodyMetricFormValues>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<30 | 90>(30);
  const [validationError, setValidationError] = useState<BodyMetricValidationCode | null>(null);
  const [saveError, setSaveError] = useState(false);

  const metrics = metricsQuery.data ?? [];
  const sortedMetrics = useMemo(
    () => [...metrics].sort((left, right) => left.entry_date.localeCompare(right.entry_date)),
    [metrics],
  );
  const weeklyAverages = calculateWeeklyWeightAverages(sortedMetrics);
  const latestAverage = weeklyAverages[weeklyAverages.length - 1];
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const chartWidth = Math.max(220, screenWidth - spacing[6] * 2 - spacing[4] * 2);

  const metricWindow = useMemo(() => {
    if (sortedMetrics.length === 0) return [];
    const endDate = sortedMetrics[sortedMetrics.length - 1].entry_date;
    return sortedMetrics.filter(
      (metric) => dateDiffDays(metric.entry_date, endDate) <= chartRange - 1,
    );
  }, [chartRange, sortedMetrics]);

  const latestWeight = sortedMetrics[sortedMetrics.length - 1]?.weight_kg ?? null;
  const sevenDayChange = calculatePeriodChange(sortedMetrics, 7);
  const thirtyDayChange = calculatePeriodChange(sortedMetrics, 30);
  const trendDirection = getWeightTrendDirection(sortedMetrics, profileGoal);
  const goalDirectionMessage = getGoalDirectionMessage(profileGoal, trendDirection);

  const goalStatusText =
    goalDirectionMessage === 'on_track'
      ? t('bodyMetrics.goalOnTrack')
      : t('bodyMetrics.goalNeutral');

  const chartAverageData = calculateMovingAverage(metricWindow, 7);
  const chartData = metricWindow.map((metric) => ({
    value: metric.weight_kg,
    label:
      metric.entry_date === metricWindow[0].entry_date ||
      metric.entry_date === metricWindow[metricWindow.length - 1].entry_date ||
      metricWindow.length > 10 && metricWindow.indexOf(metric) % Math.ceil(metricWindow.length / 6) === 0
        ? displayDate(metric.entry_date, locale, { month: 'short', day: 'numeric' })
        : '',
  }));
  const movingAverageChartData = chartAverageData.map((point) => ({
    value: point.averageKg,
    label:
      point.entry_date === chartAverageData[0].entry_date ||
      point.entry_date === chartAverageData[chartAverageData.length - 1].entry_date ||
      chartAverageData.length > 10 && chartAverageData.indexOf(point) % Math.ceil(chartAverageData.length / 6) === 0
        ? displayDate(point.entry_date, locale, { month: 'short', day: 'numeric' })
        : '',
  }));

  const measurementSummaries = useMemo<Array<{
    key: 'chest_cm' | 'waist_cm' | 'arms_cm' | 'thighs_cm';
    label: string;
    latest: number;
    delta: number;
  }>>(() => {
    const measurementKeys = ['chest_cm', 'waist_cm', 'arms_cm', 'thighs_cm'] as const;
    const labelMap = {
      chest_cm: t('bodyMetrics.chestShort'),
      waist_cm: t('bodyMetrics.waistShort'),
      arms_cm: t('bodyMetrics.armsShort'),
      thighs_cm: t('bodyMetrics.thighsShort'),
    } as const;

    return measurementKeys
      .map((field) => {
        const values = sortedMetrics
          .map((entry) => entry[field])
          .filter((value): value is number => value !== null && value !== undefined);
        if (values.length === 0) return null;
        const firstValue = values[0];
        const latestValue = values[values.length - 1];
        return {
          key: field,
          label: labelMap[field],
          latest: latestValue,
          delta: Number((latestValue - firstValue).toFixed(2)),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [sortedMetrics, t]);

  function updateField(field: keyof BodyMetricFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm());
    setShowForm(false);
    setEditingDate(null);
    setValidationError(null);
    setSaveError(false);
  }

  async function saveMetric() {
    if (!user) return;

    const result = parseBodyMetricForm(form);
    if (!result.valid) {
      setValidationError(result.code);
      setSaveError(false);
      return;
    }

    setValidationError(null);
    setSaveError(false);
    try {
      if (editingDate && form.entry_date === editingDate) {
        await mutations.update.mutateAsync({
          entryDate: form.entry_date,
          values: result.values,
        });
      } else {
        await mutations.save.mutateAsync(result.values);
      }
      resetForm();
    } catch {
      setSaveError(true);
    }
  }

  function beginEdit(metric: (typeof sortedMetrics)[number]) {
    setEditingDate(metric.entry_date);
    setForm({
      entry_date: metric.entry_date,
      weight_kg: String(metric.weight_kg),
      chest_cm: metric.chest_cm === null ? '' : String(metric.chest_cm),
      waist_cm: metric.waist_cm === null ? '' : String(metric.waist_cm),
      arms_cm: metric.arms_cm === null ? '' : String(metric.arms_cm),
      thighs_cm: metric.thighs_cm === null ? '' : String(metric.thighs_cm),
    });
    setValidationError(null);
    setSaveError(false);
    setShowForm(true);
  }

  function handleDelete(metric: (typeof sortedMetrics)[number]) {
    const label = displayDate(metric.entry_date, locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    Alert.alert(
      t('bodyMetrics.deleteTitle'),
      t('bodyMetrics.deleteConfirm', { date: label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('bodyMetrics.delete'),
          style: 'destructive',
          onPress: () => {
            mutations.remove.mutate(metric.entry_date);
          },
        },
      ],
    );
  }

  const history = [...sortedMetrics].reverse();

  return (
    <Screen padding={0} style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={metricsQuery.isRefetching}
            onRefresh={() => void metricsQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.title}>{t('tabs.progress')}</Text>
        <Text style={styles.subtitle}>{t('bodyMetrics.subtitle')}</Text>

        {saveError ? <Text style={styles.errorText}>{t('bodyMetrics.saveError')}</Text> : null}
        {validationError ? (
          <Text style={styles.errorText}>{t(`bodyMetrics.errors.${validationError}`)}</Text>
        ) : null}

        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('bodyMetrics.logMeasurement')}</Text>
            <TextField
              label={t('bodyMetrics.date')}
              value={form.entry_date}
              onChangeText={(value) => updateField('entry_date', value)}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              keyboardType="numeric"
              inputMode="numeric"
            />
            <TextField
              label={t('bodyMetrics.weight')}
              value={form.weight_kg}
              onChangeText={(value) => updateField('weight_kg', value)}
              placeholder={t('bodyMetrics.required')}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
            <View style={styles.measurements}>
              <Text style={styles.sectionLabel}>{t('bodyMetrics.measurementsOptional')}</Text>
              <TextField
                label={t('bodyMetrics.chest')}
                value={form.chest_cm}
                onChangeText={(value) => updateField('chest_cm', value)}
                placeholder={t('bodyMetrics.optional')}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
              <TextField
                label={t('bodyMetrics.waist')}
                value={form.waist_cm}
                onChangeText={(value) => updateField('waist_cm', value)}
                placeholder={t('bodyMetrics.optional')}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
              <TextField
                label={t('bodyMetrics.arms')}
                value={form.arms_cm}
                onChangeText={(value) => updateField('arms_cm', value)}
                placeholder={t('bodyMetrics.optional')}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
              <TextField
                label={t('bodyMetrics.thighs')}
                value={form.thighs_cm}
                onChangeText={(value) => updateField('thighs_cm', value)}
                placeholder={t('bodyMetrics.optional')}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
            </View>
            <Button
              label={editingDate ? t('common.save') : t('common.save')}
              loading={mutations.save.isPending || mutations.update.isPending}
              onPress={() => void saveMetric()}
            />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={mutations.save.isPending || mutations.update.isPending}
              onPress={resetForm}
            />
          </View>
        ) : (
          <Button
            label={t('bodyMetrics.logMeasurement')}
            onPress={() => {
              setForm(emptyForm());
              setEditingDate(null);
              setValidationError(null);
              setSaveError(false);
              setShowForm(true);
            }}
          />
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bodyMetrics.currentWeight')}</Text>
          {latestWeight !== null ? (
            <>
              <Text style={styles.averageValue}>
                {numberFormat.format(latestWeight)} {t('common.units.kg')}
              </Text>
              <Text style={styles.mutedText}>{t('bodyMetrics.goalDirection')}</Text>
              <Text style={styles.helperText}>{goalStatusText}</Text>
            </>
          ) : (
            <Text style={styles.mutedText}>{t('bodyMetrics.noWeightHistory')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bodyMetrics.summary')}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('bodyMetrics.change7Days')}</Text>
              <Text style={[styles.summaryValue, sevenDayChange < 0 ? styles.downTrend : styles.upTrend]}>
                {sevenDayChange > 0 ? '+' : ''}
                {numberFormat.format(sevenDayChange)} kg
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('bodyMetrics.change30Days')}</Text>
              <Text style={[styles.summaryValue, thirtyDayChange < 0 ? styles.downTrend : styles.upTrend]}>
                {thirtyDayChange > 0 ? '+' : ''}
                {numberFormat.format(thirtyDayChange)} kg
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bodyMetrics.weightTrend')}</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggle, chartRange === 30 && styles.toggleActive]}
              onPress={() => setChartRange(30)}
            >
              <Text style={[styles.toggleText, chartRange === 30 && styles.toggleActiveText]}>
                {t('bodyMetrics.last30Days')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggle, chartRange === 90 && styles.toggleActive]}
              onPress={() => setChartRange(90)}
            >
              <Text style={[styles.toggleText, chartRange === 90 && styles.toggleActiveText]}>
                {t('bodyMetrics.last90Days')}
              </Text>
            </Pressable>
          </View>
          {metricsQuery.isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : metricsQuery.isError ? (
            <View style={styles.stateBox}>
              <Text style={styles.mutedText}>{t('bodyMetrics.loadError')}</Text>
              <Button
                label={t('bodyMetrics.retry')}
                variant="secondary"
                onPress={() => void metricsQuery.refetch()}
              />
            </View>
          ) : chartData.length > 0 ? (
            <LineChart
              data={chartData}
              data2={movingAverageChartData}
              width={chartWidth}
              height={190}
              color={colors.accent}
              color2={colors.muted}
              thickness={3}
              thickness2={2}
              dataPointsColor={colors.accent}
              dataPointsRadius={4}
              hideRules
              yAxisTextStyle={styles.chartAxis}
              xAxisLabelTextStyle={styles.chartAxis}
              initialSpacing={12}
              endSpacing={12}
              noOfSections={4}
            />
          ) : (
            <Text style={styles.mutedText}>{t('bodyMetrics.noWeightHistory')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bodyMetrics.measurements')}</Text>
          {measurementSummaries.length === 0 ? (
            <Text style={styles.mutedText}>{t('bodyMetrics.noMeasurements')}</Text>
          ) : (
            <View style={styles.measurementList}>
              {measurementSummaries.map((summary) => (
                <View key={summary.key} style={styles.measurementRow}>
                  <Text style={styles.measurementName}>{summary.label}</Text>
                  <Text style={styles.measurementValue}>
                    {numberFormat.format(summary.latest)} cm
                  </Text>
                  <Text style={styles.mutedText}>
                    {summary.delta >= 0 ? '+' : ''}
                    {numberFormat.format(summary.delta)} {t('bodyMetrics.sinceFirst')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.historySection}>
          <Text style={styles.cardTitle}>{t('bodyMetrics.history')}</Text>
          {metricsQuery.isError ? null : history.length === 0 ? (
            <Text style={styles.mutedText}>{t('bodyMetrics.noHistory')}</Text>
          ) : (
            history.slice(0, 30).map((metric) => {
              const measurements = [
                metric.chest_cm !== null
                  ? `${t('bodyMetrics.chestShort')} ${numberFormat.format(metric.chest_cm)}`
                  : null,
                metric.waist_cm !== null
                  ? `${t('bodyMetrics.waistShort')} ${numberFormat.format(metric.waist_cm)}`
                  : null,
                metric.arms_cm !== null
                  ? `${t('bodyMetrics.armsShort')} ${numberFormat.format(metric.arms_cm)}`
                  : null,
                metric.thighs_cm !== null
                  ? `${t('bodyMetrics.thighsShort')} ${numberFormat.format(metric.thighs_cm)}`
                  : null,
              ].filter((value): value is string => value !== null);

              return (
                <View key={metric.id} style={styles.historyRow}>
                  <View style={styles.historyDetails}>
                    <Text style={styles.historyDate}>
                      {displayDate(metric.entry_date, locale, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    {measurements.length > 0 ? (
                      <Text style={styles.mutedText}>{measurements.join(' · ')} cm</Text>
                    ) : null}
                  </View>
                  <View style={styles.historyActions}>
                    <Text style={styles.historyWeight}>
                      {numberFormat.format(metric.weight_kg)} {t('common.units.kg')}
                    </Text>
                    <View style={styles.actionRow}>
                      <Pressable style={styles.inlineButton} onPress={() => beginEdit(metric)}>
                        <Text style={styles.inlineButtonText}>{t('bodyMetrics.edit')}</Text>
                      </Pressable>
                      <Pressable style={styles.inlineButtonDanger} onPress={() => handleDelete(metric)}>
                        <Text style={styles.inlineButtonText}>{t('bodyMetrics.delete')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.title,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    marginTop: -spacing[3],
  },
  card: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.heading,
  },
  averageValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 32,
  },
  helperText: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  mutedText: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  measurements: {
    gap: spacing[3],
  },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  stateBox: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
  chartAxis: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  toggle: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii[12],
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleText: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  toggleActiveText: {
    color: colors.background,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  summaryItem: {
    flex: 1,
    gap: spacing[1],
    padding: spacing[3],
    backgroundColor: colors.background,
    borderRadius: radii[12],
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  upTrend: {
    color: colors.accent,
  },
  downTrend: {
    color: colors.error,
  },
  measurementList: {
    gap: spacing[2],
  },
  measurementRow: {
    gap: spacing[1],
    paddingVertical: spacing[2],
  },
  measurementName: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
  },
  measurementValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  historySection: {
    gap: spacing[3],
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii[12],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyDetails: {
    flex: 1,
    gap: spacing[1],
  },
  historyDate: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.body,
  },
  historyWeight: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body,
  },
  historyActions: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  inlineButton: {
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: radii[12],
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineButtonDanger: {
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: radii[12],
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineButtonText: {
    color: colors.text,
    fontFamily: fontFamilies.medium,
    fontSize: typography.caption,
  },
});
