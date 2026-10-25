-- Migration: Phase 4 schema (v2, security-reviewed)
-- Tables: profiles, products, food_logs
-- Run ONCE on an empty database. Row Level Security (RLS) is enabled on every table.

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  birth_year INTEGER NOT NULL CHECK (birth_year BETWEEN 1900 AND 2100),
  height_cm NUMERIC NOT NULL CHECK (height_cm BETWEEN 50 AND 260),
  weight_kg NUMERIC NOT NULL CHECK (weight_kg BETWEEN 20 AND 500),
  goal TEXT NOT NULL CHECK (goal IN ('cut', 'maintain', 'lean_bulk')),
  training_days INTEGER NOT NULL CHECK (training_days BETWEEN 0 AND 7),
  body_fat_pct NUMERIC CHECK (body_fat_pct IS NULL OR body_fat_pct BETWEEN 0 AND 100),
  target_kcal INTEGER NOT NULL CHECK (target_kcal BETWEEN 0 AND 20000),
  target_protein_g NUMERIC NOT NULL CHECK (target_protein_g BETWEEN 0 AND 2000),
  target_carbs_g NUMERIC NOT NULL CHECK (target_carbs_g BETWEEN 0 AND 5000),
  target_fat_g NUMERIC NOT NULL CHECK (target_fat_g BETWEEN 0 AND 2000),
  target_bmr_kcal INTEGER CHECK (target_bmr_kcal IS NULL OR target_bmr_kcal BETWEEN 0 AND 20000),
  target_tdee_kcal INTEGER CHECK (target_tdee_kcal IS NULL OR target_tdee_kcal BETWEEN 0 AND 20000),
  -- Paid access expiry. Users can NEVER change this themselves (see trigger below);
  -- only the server (service role / SQL editor) can set it, e.g. when a code is redeemed.
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Each user can read / create / change / delete only their own profile row.
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Guard trigger:
--  * keeps updated_at current
--  * stops app users (anon / authenticated) from setting or changing
--    subscription_expires_at. Changes by them are silently ignored.
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_expires_at := NULL;
    ELSE
      NEW.subscription_expires_at := OLD.subscription_expires_at;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();


-- ============================================================================
-- 2. PRODUCTS
-- 'off'  rows = Open Food Facts data (will be written later by a server function)
-- 'user' rows = products typed in by users (private until verified by you)
-- ============================================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
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

  CONSTRAINT products_barcode_format CHECK (barcode ~ '^[0-9]{8,14}$'),
  CONSTRAINT products_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT products_brand_length CHECK (brand IS NULL OR char_length(brand) <= 200),
  CONSTRAINT products_macros_non_negative CHECK (protein >= 0 AND carbs >= 0 AND fat >= 0),
  CONSTRAINT products_kcal_range CHECK (kcal >= 0 AND kcal <= 900),
  CONSTRAINT products_macro_sum_max_100 CHECK (protein + carbs + fat <= 100),
  CONSTRAINT products_serving_range CHECK (serving_quantity_g IS NULL OR (serving_quantity_g > 0 AND serving_quantity_g <= 10000)),
  CONSTRAINT products_density_range CHECK (density_g_per_ml IS NULL OR (density_g_per_ml > 0 AND density_g_per_ml <= 5))
);

-- One Open Food Facts row per barcode; one user-submitted row per (barcode, creator).
CREATE UNIQUE INDEX products_off_barcode_uq ON public.products (barcode) WHERE source = 'off';
CREATE UNIQUE INDEX products_user_barcode_uq ON public.products (barcode, created_by) WHERE source = 'user';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone logged in sees Open Food Facts rows, verified rows, and their own submissions.
-- Other users' unverified submissions stay private, so nobody can poison a barcode for others.
CREATE POLICY "products_select_visible" ON public.products
  FOR SELECT TO authenticated
  USING (source = 'off' OR verified = true OR created_by = (SELECT auth.uid()));

-- Users can only add unverified 'user' products attributed to themselves.
CREATE POLICY "products_insert_own_user_unverified" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND source = 'user'
    AND verified = false
  );

-- Users can edit / delete only their own unverified 'user' products.
CREATE POLICY "products_update_own_unverified" ON public.products
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND source = 'user' AND verified = false)
  WITH CHECK (created_by = (SELECT auth.uid()) AND source = 'user' AND verified = false);

CREATE POLICY "products_delete_own_unverified" ON public.products
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND source = 'user' AND verified = false);


-- ============================================================================
-- 3. FOOD_LOGS
-- ============================================================================
CREATE TABLE public.food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  -- Snapshot so old diary entries keep their name if a product is renamed or removed.
  product_name TEXT NOT NULL,
  log_date DATE NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  grams NUMERIC NOT NULL,
  kcal NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT food_logs_name_length CHECK (char_length(product_name) BETWEEN 1 AND 200),
  CONSTRAINT food_logs_unit_length CHECK (char_length(unit) BETWEEN 1 AND 20),
  CONSTRAINT food_logs_quantity_range CHECK (quantity > 0 AND quantity <= 10000),
  CONSTRAINT food_logs_grams_range CHECK (grams > 0 AND grams <= 10000),
  CONSTRAINT food_logs_values_range CHECK (
    kcal >= 0 AND kcal <= 20000
    AND protein >= 0 AND protein <= 5000
    AND carbs >= 0 AND carbs <= 5000
    AND fat >= 0 AND fat <= 5000
  )
);

ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- Users see and change only their own diary rows.
CREATE POLICY "food_logs_select_own" ON public.food_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "food_logs_insert_own" ON public.food_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "food_logs_update_own" ON public.food_logs
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "food_logs_delete_own" ON public.food_logs
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- Indexes (the unique barcode indexes above already cover barcode lookups)
-- ============================================================================
CREATE INDEX idx_food_logs_user_date ON public.food_logs (user_id, log_date);
CREATE INDEX idx_food_logs_product_id ON public.food_logs (product_id);
CREATE INDEX idx_products_created_by ON public.products (created_by);
