import { useState } from 'react';
import { analyticsQuerySchema } from '@screenwise/shared';
import type { AnalyticsFilters } from '../services/analytics-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function DateRangeFilter({
  value,
  onChange,
  timezone,
}: {
  value: AnalyticsFilters;
  onChange: (value: AnalyticsFilters) => void;
  timezone?: string;
}) {
  const [mode, setMode] = useState(value.range ?? 'custom');
  const [start, setStart] = useState(value.startDate ?? '');
  const [end, setEnd] = useState(value.endDate ?? '');
  const [error, setError] = useState('');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const next =
          mode === 'custom'
            ? { startDate: start, endDate: end }
            : { range: mode as '7d' | '30d' | '90d' };
        const check = analyticsQuerySchema.safeParse(next);
        if (!check.success || (mode === 'custom' && end > today)) {
          setError(
            check.success
              ? 'Choose today or an earlier end date.'
              : (check.error.issues[0]?.message ?? 'Check dates'),
          );
          return;
        }
        setError('');
        onChange(next);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Reporting range</span>
          <select
            className="block h-10 rounded-md border bg-background px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {mode === 'custom' && (
          <>
            <label className="space-y-1 text-sm">
              From
              <Input
                type="date"
                required
                min="2000-01-01"
                max={today}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              To
              <Input
                type="date"
                required
                min={start || '2000-01-01'}
                max={today}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </>
        )}
        <Button type="submit">Apply range</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Presets include today. Custom ranges include both dates, up to 366 days.{' '}
        {timezone ?? 'Your saved timezone'}.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
