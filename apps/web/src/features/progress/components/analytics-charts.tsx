import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type {
  DailyCount,
  CategoryCount,
  AssessmentSeries,
  AdminBucket,
} from '@screenwise/shared';
import { Section, NoData, label, formatAt } from './analytics-elements';
const colors = [
  '#6366f1',
  '#14b8a6',
  '#a78bfa',
  '#f59e0b',
  '#38bdf8',
  '#f472b6',
];
const tooltipStyle = {
  background: 'var(--card)',
  color: 'var(--foreground)',
  borderColor: 'var(--border)',
  borderRadius: 12,
};
const dayLabel = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
export function ActivityCompletionChart({
  data,
  title = 'Activity completions',
}: {
  data: DailyCount[];
  title?: string;
}) {
  return (
    <Section
      title={title}
      description={`${data.reduce((sum, d) => sum + d.count, 0)} completed sessions across ${data.length} local days.`}
    >
      {!data.some((d) => d.count > 0) ? (
        <NoData>
          No saved completions in this range. Explore prevention activities to
          get started.
        </NoData>
      ) : (
        <div
          className="h-64 min-w-0"
          role="img"
          aria-label="Completed wellness activities by local day"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={dayLabel}
                minTickGap={24}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} width={35} />
              <Tooltip
                labelFormatter={(v) => dayLabel(String(v))}
                contentStyle={tooltipStyle}
              />
              <Bar
                dataKey="count"
                name="Completions"
                fill={colors[0]}
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="text-sm">
        <summary>View daily counts</summary>
        <div className="max-h-52 overflow-y-auto">
          <ul>
            {data.map((d) => (
              <li key={d.date}>
                {d.date}: {d.count}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </Section>
  );
}
export function AssessmentTrendChart({
  series,
  timezone,
}: {
  series: AssessmentSeries[];
  timezone: string;
}) {
  return (
    <Section
      title="Assessment trends"
      description="Scores summarize educational questionnaires and self-reported answers. Score changes do not prove clinical improvement. Different questionnaires and incompatible scoring versions are kept separate."
    >
      {!series.length ? (
        <NoData>
          Complete an assessment to see saved scores in this date range.
        </NoData>
      ) : (
        series.map((s) => (
          <div
            key={s.assessmentId + s.compatibilityKey}
            className="space-y-3 rounded-lg border p-4"
          >
            <h3 className="font-medium">
              {s.title} · {label(s.category)}
            </h3>
            <p className="text-xs text-muted-foreground">
              Scoring group: {s.compatibilityKey}. Versions{' '}
              {Array.from(new Set(s.points.map((p) => p.version))).join(', ')}.
            </p>
            {s.points.length < 2 ? (
              <NoData>
                One result recorded ({s.points[0]?.score}/100). Another
                compatible result is needed for a trend.
              </NoData>
            ) : (
              <div
                className="h-60 min-w-0"
                role="img"
                aria-label={`${s.title} normalized scores over time`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.points}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) =>
                        new Date(String(v)).toLocaleDateString(undefined, {
                          timeZone: timezone,
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      minTickGap={25}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis domain={[0, 100]} width={35} />
                    <Tooltip
                      content={({ active, payload }) => {
                        const p = payload?.[0]?.payload as
                          AssessmentSeries['points'][number] | undefined;
                        return active && p ? (
                          <div className="max-w-60 rounded-xl border bg-card p-3 text-sm">
                            {formatAt(p.date, timezone)}
                            <br />
                            {p.score}/100 · {p.feedback}
                            <br />
                            Version {p.version}
                          </div>
                        ) : null;
                      }}
                    />
                    <Line
                      dataKey="score"
                      name="Reported concern (0–100)"
                      stroke={colors[0]}
                      strokeWidth={2}
                      type="linear"
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <details className="text-sm">
              <summary>View results and feedback</summary>
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {s.points.map((p) => (
                  <li key={p.id}>
                    {formatAt(p.date, timezone)} · {p.score}/100 · {p.feedback}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))
      )}
    </Section>
  );
}
export function ActivityDistributionChart({ data }: { data: CategoryCount[] }) {
  const rows = data.map((d) => ({ ...d, name: label(d.category) }));
  return (
    <Section
      title="Activity categories"
      description="Distribution of completed sessions using the category saved when each session started."
    >
      {!rows.length ? (
        <NoData>No category data yet.</NoData>
      ) : (
        <>
          <div
            className="h-72"
            role="img"
            aria-label="Completed activities by category"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="70%"
                  isAnimationActive={false}
                >
                  {rows.map((d, i) => (
                    <Cell key={d.category} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap gap-3 text-xs">
            {rows.map((d) => (
              <li key={d.category}>
                {d.name}: {d.count}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
export function AdminAnalyticsChart({
  title,
  rows,
}: {
  title: string;
  rows: AdminBucket[];
}) {
  if (rows.some((r) => r.suppressed))
    return (
      <Section title={title}>
        <NoData>
          Hidden to protect small groups. Every nonempty group needs at least
          five distinct contributors; the whole breakdown is hidden when one
          group is too small.
        </NoData>
      </Section>
    );
  return (
    <Section title={title}>
      {!rows.some((r) => (r.value ?? 0) > 0) ? (
        <NoData>No aggregate data in this range.</NoData>
      ) : (
        <div className="h-64" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows.map((r) => ({
                ...r,
                label: r.label.includes('_') ? label(r.label) : r.label,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis allowDecimals={false} width={35} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="value"
                name="Count"
                fill={colors[1]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="text-sm">
        <summary>View aggregate counts</summary>
        <ul className="max-h-52 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.label}>
              {label(r.label)}: {r.value}
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}
