import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { TrendGroup } from '@screenwise/shared';
export function AssessmentTrendChart({ groups }: { groups: TrendGroup[] }) {
  return (
    <div className="space-y-7">
      {!groups.length && (
        <p className="text-sm text-muted-foreground">
          Complete an assessment to see your saved scores here.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.compatibilityKey} className="rounded-xl border p-5">
          <h3 className="font-semibold">
            Compatible versions: {g.versionNumbers.join(', ')}
          </h3>
          <p className="my-3 text-xs text-muted-foreground">
            Scores summarize self-reported answers. Changes are not evidence of
            clinical improvement.{' '}
            {g.points.length === 1
              ? 'Only one result is available; another compatible result is needed for a trend.'
              : ''}
          </p>
          {g.points.length > 1 && (
            <div
              className="h-60 w-full"
              role="img"
              aria-label="Saved assessment scores over time"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={g.points.map((p) => ({
                    ...p,
                    date: new Date(p.submitted_at).toLocaleString(),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      color: 'var(--foreground)',
                      borderColor: 'var(--border)',
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="normalized_score"
                    name="Reported concern"
                    stroke="#6366F1"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <details className="mt-4 text-sm">
            <summary>View score data</summary>
            <ul className="mt-3 space-y-2">
              {g.points.map((p) => (
                <li key={p.id}>
                  {new Date(p.submitted_at).toLocaleString()} ·{' '}
                  {p.normalized_score}/100 · Version {p.version_number}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
    </div>
  );
}
