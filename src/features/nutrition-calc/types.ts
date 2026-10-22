export type Gender = 'male' | 'female';
export type Goal = 'cut' | 'maintain' | 'lean_bulk';
export type BmrFormula = 'mifflin-st-jeor' | 'katch-mcardle';
export type MacroWarning =
  | 'PROTEIN_CAPPED'
  | 'FAT_REDUCED_TO_FLOOR'
  | 'PROTEIN_REDUCED'
  | 'CALORIES_RAISED'
  | 'CALORIES_RAISED_TO_FLOOR';

export type BmrInput = {
  gender: Gender;
  age: number;
  weightKg: number;
  heightCm: number;
  bodyFatPercent?: number;
};

export type BmrResult = {
  bmr: number;
  formula: BmrFormula;
};

export type CalculatorInput = BmrInput & {
  trainingDaysPerWeek: number;
  goal: Goal;
};

export type MacroInput = {
  calories: number;
  weightKg: number;
  bodyFatPercent?: number;
  goal: Goal;
};

export type MacroResult = {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  warnings: MacroWarning[];
};

export type NutritionPlan = MacroResult & {
  bmr: number;
  tdee: number;
  bmrFormula: BmrFormula;
};
