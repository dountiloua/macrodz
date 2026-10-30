import type { BodyMetric, BodyMetricTrendDirection, MovingAveragePoint, WeeklyWeightAverage } from './types';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(entryDate: string): string {
  const date = parseLocalDate(entryDate);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return toLocalDateString(date);
}

export function calculateWeeklyWeightAverages(
  entries: Pick<BodyMetric, 'entry_date' | 'weight_kg'>[],
): WeeklyWeightAverage[] {
  const weeks = new Map<string, { total: number; entries: number }>();

  for (const entry of entries) {
    const weekStart = getWeekStart(entry.entry_date);
    const week = weeks.get(weekStart) ?? { total: 0, entries: 0 };
    week.total += entry.weight_kg;
    week.entries += 1;
    weeks.set(weekStart, week);
  }

  return [...weeks.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, week]) => ({
      weekStart,
      averageKg: week.total / week.entries,
      entries: week.entries,
    }));
}

export function calculateMovingAverage(
  entries: Pick<BodyMetric, 'entry_date' | 'weight_kg'>[],
  windowSize = 7,
): MovingAveragePoint[] {
  if (entries.length === 0) return [];

  const sortedEntries = [...entries].sort((left, right) => left.entry_date.localeCompare(right.entry_date));
  const byDate = new Map(sortedEntries.map((entry) => [entry.entry_date, entry.weight_kg]));
  const dates = [...byDate.keys()].sort();

  return dates.map((dateKey) => {
    const currentValue = byDate.get(dateKey) ?? 0;
    const currentDate = parseLocalDate(dateKey);
    const windowStart = new Date(currentDate);
    windowStart.setDate(windowStart.getDate() - (windowSize - 1));

    let total = 0;
    let count = 0;

    for (let cursor = new Date(windowStart); cursor <= currentDate; cursor.setDate(cursor.getDate() + 1)) {
      const key = toLocalDateString(cursor);
      const value = byDate.get(key);
      if (value === undefined) continue;
      total += value;
      count += 1;
    }

    return {
      entry_date: dateKey,
      averageKg: Number((count > 0 ? total / count : currentValue).toFixed(2)),
    };
  });
}

export function calculatePeriodChange(
  entries: Pick<BodyMetric, 'entry_date' | 'weight_kg'>[],
  days: 7 | 30,
): number {
  if (entries.length === 0) return 0;

  const sorted = [...entries].sort((left, right) => left.entry_date.localeCompare(right.entry_date));
  const latest = sorted[sorted.length - 1];
  const earliestAllowed = new Date(parseLocalDate(latest.entry_date));
  earliestAllowed.setDate(earliestAllowed.getDate() - (days - 1));

  const windowStartDate = toLocalDateString(earliestAllowed);
  const windowEntries = sorted.filter(
    (entry) => entry.entry_date >= windowStartDate && entry.entry_date <= latest.entry_date,
  );

  if (windowEntries.length < 2) {
    return 0;
  }

  const movingAverage = calculateMovingAverage(windowEntries, 7);
  const currentAverage = movingAverage[movingAverage.length - 1]?.averageKg ?? latest.weight_kg;
  const baseline = movingAverage[0]?.averageKg ?? windowEntries[0].weight_kg;

  return Number((currentAverage - baseline).toFixed(2));
}

export function getWeightTrendDirection(
  entries: Pick<BodyMetric, 'entry_date' | 'weight_kg'>[],
  goal: 'cut' | 'maintain' | 'lean_bulk',
): BodyMetricTrendDirection {
  if (entries.length < 2) return 'neutral';

  const sorted = [...entries].sort((left, right) => left.entry_date.localeCompare(right.entry_date));
  const value = calculatePeriodChange(sorted, 30);

  if (goal === 'cut') {
    return value < 0 ? 'down' : value > 0 ? 'up' : 'neutral';
  }

  if (goal === 'maintain') {
    return Math.abs(value) < 0.3 ? 'neutral' : value < 0 ? 'down' : 'up';
  }

  return value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
}

export function getGoalDirectionMessage(
  goal: 'cut' | 'maintain' | 'lean_bulk',
  trend: BodyMetricTrendDirection,
): string {
  if (goal === 'cut') {
    return trend === 'down' ? 'on_track' : 'neutral';
  }

  if (goal === 'maintain') {
    return trend === 'neutral' ? 'on_track' : 'neutral';
  }

  return trend === 'up' ? 'on_track' : 'neutral';
}
