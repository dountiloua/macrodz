-- Migration: Phase 6 body metrics
-- Runs once for authenticated users. Each user can only access their own rows.

CREATE TABLE public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL CHECK (weight_kg BETWEEN 20 AND 500),
  chest_cm NUMERIC CHECK (chest_cm IS NULL OR (chest_cm BETWEEN 20 AND 300)),
  waist_cm NUMERIC CHECK (waist_cm IS NULL OR (waist_cm BETWEEN 20 AND 300)),
  arms_cm NUMERIC CHECK (arms_cm IS NULL OR (arms_cm BETWEEN 10 AND 150)),
  thighs_cm NUMERIC CHECK (thighs_cm IS NULL OR (thighs_cm BETWEEN 10 AND 200)),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT body_metrics_user_date_unique UNIQUE (user_id, entry_date)
);

CREATE INDEX body_metrics_user_date_idx ON public.body_metrics (user_id, entry_date);

ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "body_metrics_select_own" ON public.body_metrics
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "body_metrics_insert_own" ON public.body_metrics
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "body_metrics_update_own" ON public.body_metrics
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "body_metrics_delete_own" ON public.body_metrics
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.body_metrics_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER body_metrics_touch_updated_at_trg
  BEFORE INSERT OR UPDATE ON public.body_metrics
  FOR EACH ROW EXECUTE FUNCTION public.body_metrics_touch_updated_at();
