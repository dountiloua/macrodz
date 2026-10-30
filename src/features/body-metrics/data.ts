import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import type { BodyMetric, BodyMetricValues } from './types';
import { isValidBodyMetricValues } from './validation';

export class BodyMetricDataError extends Error {
  constructor() {
    super('Body metric data operation failed');
    this.name = 'BodyMetricDataError';
  }
}

function fail(error: unknown): never {
  console.error('Body metric data operation failed.', error);
  throw new BodyMetricDataError();
}

export async function listBodyMetrics(
  userId: string,
  client: SupabaseClient = supabase,
): Promise<BodyMetric[]> {
  if (!userId.trim()) return fail(new Error('Invalid body metric user identifier'));

  try {
    const { data, error } = await client
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .limit(365);

    if (error) return fail(error);
    return ((data ?? []) as BodyMetric[]).reverse();
  } catch (error) {
    if (error instanceof BodyMetricDataError) throw error;
    return fail(error);
  }
}

export async function saveBodyMetric(
  values: BodyMetricValues,
  client: SupabaseClient = supabase,
): Promise<BodyMetric> {
  if (!isValidBodyMetricValues(values)) return fail(new Error('Invalid body metric values'));

  try {
    const { data, error } = await client
      .from('body_metrics')
      .upsert(values, { onConflict: 'user_id,entry_date' })
      .select('*')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty body metric save result'));
    }

    return data as BodyMetric;
  } catch (error) {
    if (error instanceof BodyMetricDataError) throw error;
    return fail(error);
  }
}

export async function updateBodyMetric(
  userId: string,
  entryDate: string,
  values: Omit<BodyMetricValues, 'user_id' | 'entry_date'>,
  client: SupabaseClient = supabase,
): Promise<BodyMetric> {
  if (!userId.trim() || !entryDate.trim()) {
    return fail(new Error('Invalid body metric identifiers'));
  }

  const payload = { ...values, user_id: userId, entry_date: entryDate } as BodyMetricValues;
  if (!isValidBodyMetricValues(payload)) {
    return fail(new Error('Invalid body metric values'));
  }

  try {
    const { data, error } = await client
      .from('body_metrics')
      .update({
        weight_kg: payload.weight_kg,
        chest_cm: payload.chest_cm,
        waist_cm: payload.waist_cm,
        arms_cm: payload.arms_cm,
        thighs_cm: payload.thighs_cm,
      })
      .eq('user_id', userId)
      .eq('entry_date', entryDate)
      .select('*')
      .single();

    if (error || data === null) {
      return fail(error ?? new Error('Empty body metric update result'));
    }

    return data as BodyMetric;
  } catch (error) {
    if (error instanceof BodyMetricDataError) throw error;
    return fail(error);
  }
}

export async function deleteBodyMetric(
  userId: string,
  entryDate: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  if (!userId.trim() || !entryDate.trim()) {
    return fail(new Error('Invalid body metric identifiers'));
  }

  try {
    const { error } = await client
      .from('body_metrics')
      .delete()
      .eq('user_id', userId)
      .eq('entry_date', entryDate);

    if (error) {
      return fail(error);
    }
  } catch (error) {
    if (error instanceof BodyMetricDataError) throw error;
    return fail(error);
  }
}
