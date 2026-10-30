import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { GENERIC_FOODS, searchGenericFoods } from '@/features/generic-foods';
import {
  buildLogFoodParams,
  getNutritionPer100g,
  readSingleParam,
  type Meal,
} from '@/features/diary';
import { MEALS } from '@/features/diary/types';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme/tokens';

function isMeal(value: string | undefined): value is Meal {
  return value !== undefined && (MEALS as readonly string[]).includes(value);
}

export default function AddFoodScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = readSingleParam(params.date) ?? '';
  const meal = readSingleParam(params.meal);
  const [search, setSearch] = useState('');
  const foods = searchGenericFoods(search);
  const language = i18n.language.startsWith('fr') ? 'fr' : 'en';

  function chooseFood(food: (typeof GENERIC_FOODS)[number]) {
    const name = food.names[language];
    router.push({
      pathname: '/log-food',
      params: buildLogFoodParams(date, isMeal(meal) ? meal : 'snack', {
        name,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        servingQuantityG: food.servingQuantityG,
      }),
    });
  }

  return (
    <Screen padding={0} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        <Text style={styles.title}>{t('diary.addFoodTitle')}</Text>
        <View style={styles.options}>
          <Button
            label={t('diary.scanFood')}
            onPress={() =>
              router.push({
                pathname: '/scan',
                params: { diary: 'true', date, meal: isMeal(meal) ? meal : 'snack' },
              })
            }
          />
          <Button
            label={t('diary.manualFood')}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/manual-food',
                params: { date, meal: isMeal(meal) ? meal : 'snack' },
              })
            }
          />
        </View>

        <Text style={styles.sectionTitle}>{t('diary.searchGeneric')}</Text>
        <TextField
          label={t('diary.searchLabel')}
          value={search}
          onChangeText={setSearch}
          placeholder={t('diary.searchPlaceholder')}
          autoCapitalize="none"
        />
        <Text style={styles.approximation}>{t('diary.approximateNotice')}</Text>
        {foods.map((food) => {
          const nutrition = getNutritionPer100g(food);
          return (
            <Pressable
              accessibilityRole="button"
              key={food.id}
              onPress={() => chooseFood(food)}
              style={styles.foodRow}
            >
              <View style={styles.foodCopy}>
                <Text style={styles.foodName}>{food.names[language]}</Text>
                {nutrition ? (
                  <Text style={styles.foodMacros}>
                    {t('diary.nutritionPer100g', {
                      kcal: Math.round(nutrition.kcal),
                      protein: nutrition.protein,
                      carbs: nutrition.carbs,
                      fat: nutrition.fat,
                    })}
                  </Text>
                ) : (
                  <Text style={styles.foodMacros}>{t('diary.nutritionMissing')}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          );
        })}
        {foods.length === 0 ? <Text style={styles.noResults}>{t('diary.noResults')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[8] },
  title: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.title },
  options: { gap: spacing[3] },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.bold, fontSize: typography.heading },
  approximation: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  foodRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    borderRadius: radii[12],
    borderColor: colors.border,
    borderWidth: 1,
  },
  foodCopy: { flex: 1, gap: spacing[1] },
  foodName: { color: colors.text, fontFamily: fontFamilies.medium, fontSize: typography.body },
  foodMacros: {
    color: colors.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption,
  },
  noResults: { color: colors.muted, fontFamily: fontFamilies.regular, fontSize: typography.body },
});
