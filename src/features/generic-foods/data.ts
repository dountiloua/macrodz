import type { DiaryFood } from '../diary/types';

export type GenericFood = Omit<DiaryFood, 'name'> & {
  id: string;
  names: { fr: string; en: string };
  verified: false;
};

// Approximate nutrition values throughout this list; needs verification against a food composition table.
export const GENERIC_FOODS: GenericFood[] = [
  {
    id: 'khobz',
    names: { fr: 'Khobz (pain traditionnel)', en: 'Khobz (traditional bread)' },
    kcal: 270,
    protein: 8.5,
    carbs: 54,
    fat: 1.5,
    servingQuantityG: 60,
    verified: false,
  },
  {
    id: 'baguette',
    names: { fr: 'Baguette', en: 'Baguette' },
    kcal: 274,
    protein: 9,
    carbs: 57,
    fat: 1,
    servingQuantityG: 50,
    verified: false,
  },
  {
    id: 'couscous-cooked',
    names: { fr: 'Couscous cuit', en: 'Cooked couscous' },
    kcal: 112,
    protein: 3.8,
    carbs: 23,
    fat: 0.2,
    verified: false,
  },
  {
    id: 'chorba',
    names: { fr: 'Chorba', en: 'Chorba soup' },
    kcal: 55,
    protein: 3,
    carbs: 7,
    fat: 1.5,
    servingQuantityG: 300,
    verified: false,
  },
  {
    id: 'chakhchoukha',
    names: { fr: 'Chakhchoukha', en: 'Chakhchoukha' },
    kcal: 145,
    protein: 6,
    carbs: 21,
    fat: 4,
    verified: false,
  },
  {
    id: 'chakhchouka',
    names: { fr: 'Chakchouka', en: 'Shakshuka' },
    kcal: 95,
    protein: 4,
    carbs: 7,
    fat: 5.5,
    servingQuantityG: 250,
    verified: false,
  },
  {
    id: 'lben',
    names: { fr: 'Lben', en: 'Lben (buttermilk)' },
    kcal: 40,
    protein: 3.3,
    carbs: 4.8,
    fat: 0.9,
    servingQuantityG: 250,
    verified: false,
  },
  {
    id: 'raib',
    names: { fr: 'Raïb', en: 'Raib (fermented milk)' },
    kcal: 62,
    protein: 3.3,
    carbs: 4.7,
    fat: 3.2,
    servingQuantityG: 125,
    verified: false,
  },
  {
    id: 'dates',
    names: { fr: 'Dattes', en: 'Dates' },
    kcal: 282,
    protein: 2.5,
    carbs: 75,
    fat: 0.4,
    servingQuantityG: 8,
    verified: false,
  },
  {
    id: 'olive-oil',
    names: { fr: "Huile d'olive", en: 'Olive oil' },
    kcal: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
    servingQuantityG: 13,
    verified: false,
  },
  {
    id: 'rice-cooked',
    names: { fr: 'Riz cuit', en: 'Cooked rice' },
    kcal: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    verified: false,
  },
  {
    id: 'chicken',
    names: { fr: 'Poulet cuit', en: 'Cooked chicken' },
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    verified: false,
  },
  {
    id: 'egg',
    names: { fr: 'Œuf', en: 'Egg' },
    kcal: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    servingQuantityG: 50,
    verified: false,
  },
  {
    id: 'lentils-cooked',
    names: { fr: 'Lentilles cuites', en: 'Cooked lentils' },
    kcal: 116,
    protein: 9,
    carbs: 20,
    fat: 0.4,
    verified: false,
  },
  {
    id: 'white-beans',
    names: { fr: 'Haricots blancs cuits', en: 'Cooked white beans' },
    kcal: 139,
    protein: 9.7,
    carbs: 25,
    fat: 0.4,
    verified: false,
  },
  {
    id: 'chickpeas',
    names: { fr: 'Pois chiches cuits', en: 'Cooked chickpeas' },
    kcal: 164,
    protein: 8.9,
    carbs: 27.4,
    fat: 2.6,
    verified: false,
  },
  {
    id: 'potato',
    names: { fr: 'Pomme de terre cuite', en: 'Cooked potato' },
    kcal: 87,
    protein: 1.9,
    carbs: 20,
    fat: 0.1,
    verified: false,
  },
  {
    id: 'tomato',
    names: { fr: 'Tomate', en: 'Tomato' },
    kcal: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    verified: false,
  },
  {
    id: 'carrot',
    names: { fr: 'Carotte', en: 'Carrot' },
    kcal: 41,
    protein: 0.9,
    carbs: 9.6,
    fat: 0.2,
    verified: false,
  },
  {
    id: 'onion',
    names: { fr: 'Oignon', en: 'Onion' },
    kcal: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
    verified: false,
  },
  {
    id: 'sardines',
    names: { fr: 'Sardines', en: 'Sardines' },
    kcal: 208,
    protein: 24.6,
    carbs: 0,
    fat: 11.5,
    verified: false,
  },
  {
    id: 'lamb',
    names: { fr: 'Agneau cuit', en: 'Cooked lamb' },
    kcal: 258,
    protein: 25,
    carbs: 0,
    fat: 17,
    verified: false,
  },
  {
    id: 'beef',
    names: { fr: 'Bœuf cuit', en: 'Cooked beef' },
    kcal: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
    verified: false,
  },
  {
    id: 'semolina-cooked',
    names: { fr: 'Semoule cuite', en: 'Cooked semolina' },
    kcal: 120,
    protein: 3.8,
    carbs: 25,
    fat: 0.2,
    verified: false,
  },
  {
    id: 'brik',
    names: { fr: 'Brik à l’œuf', en: 'Egg brik' },
    kcal: 240,
    protein: 9,
    carbs: 24,
    fat: 12,
    servingQuantityG: 150,
    verified: false,
  },
  {
    id: 'makroud',
    names: { fr: 'Makroud', en: 'Makroud' },
    kcal: 390,
    protein: 5,
    carbs: 65,
    fat: 13,
    servingQuantityG: 40,
    verified: false,
  },
];

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLocaleLowerCase()
    .trim();
}

export function searchGenericFoods(query: string, foods: readonly GenericFood[] = GENERIC_FOODS) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [...foods];

  return foods.filter((food) =>
    normalizeSearch(`${food.names.fr} ${food.names.en} ${food.id}`).includes(normalizedQuery),
  );
}
