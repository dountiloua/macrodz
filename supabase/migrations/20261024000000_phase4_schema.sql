-- Migration: Phase 4 Initial Schema
-- Tables: profiles, products, food_logs
-- Includes check constraints, foreign keys, and Row Level Security (RLS) policies.

-- ============================================================================
-- 1. PROFILES TABLE
-- Stores user metrics, goal settings, and computed daily calorie & macro targets.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  birth_year INTEGER NOT NULL CHECK (birth_year >= 1900 AND birth_year <= 2100),
  height_cm NUMERIC NOT NULL CHECK (height_cm > 0),
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0),
  goal TEXT NOT NULL CHECK (goal IN ('cut', 'maintain', 'lean_bulk')),
  training_days INTEGER NOT NULL CHECK (training_days >= 0 AND training_days <= 7),
  body_fat_pct NUMERIC CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100)),
  target_kcal INTEGER NOT NULL CHECK (target_kcal >= 0),
  target_protein_g NUMERIC NOT NULL CHECK (target_protein_g >= 0),
  target_carbs_g NUMERIC NOT NULL CHECK (target_carbs_g >= 0),
  target_fat_g NUMERIC NOT NULL CHECK (target_fat_g >= 0),
  target_bmr_kcal INTEGER CHECK (target_bmr_kcal IS NULL OR target_bmr_kcal >= 0),
  target_tdee_kcal INTEGER CHECK (target_tdee_kcal IS NULL OR target_tdee_kcal >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own profile.
CREATE POLICY "Users can select their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- Policy: Users can only insert their own profile row.
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Policy: Users can only update their own profile row.
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Policy: Users can only delete their own profile row.
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- 2. PRODUCTS TABLE
-- Catalog of food products populated from Open Food Facts ('off') or users ('user').
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL CHECK (barcode ~ '^[0-9]{8,14}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  brand TEXT,
  kcal NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  serving_quantity_g NUMERIC,
  density_g_per_ml NUMERIC,
  source TEXT NOT NULL CHECK (source IN ('off', 'user')),
  verified BOOLEAN DEFAULT false NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Nutritional check constraints:
  -- 1. Macros must be non-negative
  CONSTRAINT products_macros_non_negative CHECK (
    protein >= 0 AND carbs >= 0 AND fat >= 0
  ),
  -- 2. Calories per 100g must be between 0 and 900 kcal
  CONSTRAINT products_kcal_max_900 CHECK (
    kcal >= 0 AND kcal <= 900
  ),
  -- 3. Sum of protein + carbs + fat per 100g cannot exceed 100g
  CONSTRAINT products_macro_sum_max_100 CHECK (
    protein + carbs + fat <= 100
  ),
  -- 4. Positive serving and density if specified
  CONSTRAINT products_serving_positive CHECK (
    serving_quantity_g IS NULL OR serving_quantity_g > 0
  ),
  CONSTRAINT products_density_positive CHECK (
    density_g_per_ml IS NULL OR density_g_per_ml > 0
  )
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read official and verified products, plus their own products.
CREATE POLICY "Authenticated users can select visible products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    source = 'off'
    OR verified = true
    OR created_by = (select auth.uid())
  );

-- Policy: Authenticated users can insert only their own unverified user-submitted products.
CREATE POLICY "Authenticated users can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND source = 'user'
    AND verified = false
  );

-- Policy: Users can only update unverified user-submitted products they created themselves.
-- Verified products cannot be edited by regular users.
CREATE POLICY "Users can update their own unverified products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) AND verified = false AND source = 'user'
  )
  WITH CHECK (
    created_by = (select auth.uid()) AND verified = false AND source = 'user'
  );

-- Policy: Users can only delete unverified user-submitted products they created themselves.
-- Verified products cannot be deleted by regular users.
CREATE POLICY "Users can delete their own unverified products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    created_by = (select auth.uid()) AND verified = false AND source = 'user'
  );


-- ============================================================================
-- 3. FOOD_LOGS TABLE
-- User daily meal diary entries and computed nutritional totals.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  log_date DATE NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'unit', 'pot', 'tbsp', 'tsp', 'glass', 'cup')),
  grams NUMERIC NOT NULL,
  kcal NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints:
  -- 1. Quantity and grams must be greater than 0
  CONSTRAINT food_logs_quantity_range CHECK (quantity > 0 AND quantity <= 10000),
  CONSTRAINT food_logs_grams_range CHECK (grams > 0 AND grams <= 10000),
  -- 2. Nutritional values must be non-negative
  CONSTRAINT food_logs_macros_non_negative CHECK (
    kcal >= 0 AND protein >= 0 AND carbs >= 0 AND fat >= 0
  ),
  CONSTRAINT food_logs_kcal_max_20000 CHECK (kcal <= 20000)
);

-- Enable Row Level Security
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can select only their own food log rows.
CREATE POLICY "Users can select their own food logs"
  ON public.food_logs
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Policy: Users can insert food log rows only for their own user ID.
CREATE POLICY "Users can insert their own food logs"
  ON public.food_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can update only their own food log rows.
CREATE POLICY "Users can update their own food logs"
  ON public.food_logs
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can delete only their own food log rows.
CREATE POLICY "Users can delete their own food logs"
  ON public.food_logs
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);


-- ============================================================================
-- Indexes for query performance
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_off_barcode
  ON public.products(barcode)
  WHERE source = 'off';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_barcode_created_by
  ON public.products(barcode, created_by)
  WHERE source = 'user';
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON public.food_logs(user_id, log_date);
