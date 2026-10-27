import type { WellnessReportData } from '@screenwise/shared';
import { jsPDF } from 'jspdf';
import reportFontUrl from './fonts/NotoSans-Regular.ttf?url';
const disclaimer =
  'This report provides educational wellness information and self-reported activity summaries. It is not a medical diagnosis or a substitute for professional healthcare advice.';
export async function generateWellnessReport(data: WellnessReportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const width = 174;
  let y = 24;
  const fontResponse = await fetch(reportFontUrl);
  if (!fontResponse.ok)
    throw new Error('Report font could not be loaded. Please retry.');
  const bytes = new Uint8Array(await fontResponse.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  doc.addFileToVFS('NotoSans-Regular.ttf', btoa(binary));
  doc.addFont('NotoSans-Regular.ttf', 'ScreenWise', 'normal');
  const newPage = () => {
    doc.addPage();
    y = 24;
  };
  function text(value: string, size = 10, bold = false) {
    doc.setFont('ScreenWise', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(bold ? 65 : 35, bold ? 70 : 42, bold ? 150 : 65);
    const lines = doc.splitTextToSize(value, width) as string[];
    for (const line of lines) {
      if (y > 263) newPage();
      doc.text(line, margin, y);
      y += size * 0.42 + 1.5;
    }
    y += 2;
  }
  function heading(value: string) {
    if (y > 245) newPage();
    y += 4;
    doc.setDrawColor(99, 102, 241);
    doc.line(margin, y - 3, 192, y - 3);
    text(value, 14, true);
  }
  const at = (v: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: data.period.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(v));
  text('ScreenWise Wellness', 21, true);
  text('Digital Wellness Progress Report', 14, true);
  text(data.fullName, 12);
  text('Generated: ' + at(data.generatedAt));
  text(
    'Period: ' +
      data.period.startDate +
      ' to ' +
      data.period.endDate +
      ' (' +
      data.period.timezone +
      ')',
  );
  heading('1. Wellness overview');
  text(
    'Assessments completed: ' +
      data.overview.assessments +
      ' | Activities completed: ' +
      data.overview.activities,
  );
  text(
    'Active goals at range end: ' +
      data.goals.active +
      ' | Goal periods achieved: ' +
      data.goals.achieved +
      ' | Pending: ' +
      data.goals.pending +
      ' | Achievement: ' +
      data.goals.completionPercentage +
      '%',
  );
  text(
    data.streak.goalTitle
      ? 'Goal streak: ' +
          data.streak.current +
          ' ' +
          data.streak.unit +
          ' (' +
          data.streak.goalTitle +
          '); longest ' +
          data.streak.longest +
          '.'
      : 'No applicable goal streak recorded.',
  );
  text(
    'Streaks follow consecutive achieved goal periods. Pauses and missed finished periods break the run; an unfinished current period has until its end.',
  );
  heading('2. Assessment summary');
  text(
    'Educational questionnaire scores summarize self-reported answers. Changes do not prove clinical improvement. Each questionnaire and scoring compatibility group is reported separately.',
  );
  if (!data.assessments.length) text('No assessments completed in this range.');
  let count = 0;
  for (const series of data.assessments) {
    text(
      series.title +
        ' | ' +
        series.category +
        ' | Scoring group: ' +
        series.compatibilityKey,
      11,
      true,
    );
    for (const p of series.points) {
      text(
        at(p.date) +
          ' | Version ' +
          p.version +
          ' | ' +
          p.score +
          '/100 | ' +
          p.feedback,
        10,
        true,
      );
      text(p.explanation);
      if (++count % 50 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  heading('3. Activity summary');
  text(
    'Category counts use saved session snapshots, including archived activity definitions. These are self-reported completions; elapsed time does not measure device usage.',
  );
  if (!data.distribution.length) text('No activities completed in this range.');
  for (const d of data.distribution)
    text(d.category.replaceAll('_', ' ') + ': ' + d.count);
  text('Daily activity completion trend', 11, true);
  for (let i = 0; i < data.daily.length; i += 4)
    text(
      data.daily
        .slice(i, i + 4)
        .map((d) => d.date + ': ' + d.count)
        .join('    |    '),
    );
  heading('4. Goal summary');
  text(
    'Current saved definitions, evaluated at range end. Achievement includes unpaused goal periods starting in the range, counting only completions within selected local dates. Current-period progress may include earlier dates in that goal period. Previous goal definitions are not replayed.',
  );
  if (!data.goals.rows.length) text('No goals recorded.');
  for (const g of data.goals.rows) {
    text(g.title + ' | ' + g.status + ' | ' + g.period, 11, true);
    text(
      'Current period: ' +
        g.periodStart +
        ' to ' +
        g.periodEnd +
        ' (' +
        g.timezone +
        ') | ' +
        g.count +
        '/' +
        g.target +
        ' (' +
        g.percentage +
        '%)',
    );
    text(
      'In range: ' +
        g.history.filter((h) => h.met && !h.paused).length +
        ' achieved, ' +
        g.history.filter((h) => !h.met && !h.paused).length +
        ' pending, ' +
        g.history.filter((h) => h.paused).length +
        ' paused.',
    );
  }
  heading('5. Current wellness recommendations');
  text(
    'Current active educational recommendations, generated from your assessments and wellness interests. They are not restricted to the reporting dates.',
  );
  if (!data.recommendations.length) text('No active recommendations.');
  for (const r of data.recommendations) {
    const s = r.content_snapshot;
    text(s.title + ' | ' + s.type + ' | Priority ' + s.priority, 11, true);
    text(s.description);
    text(s.why);
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('ScreenWise', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    const lines = doc.splitTextToSize(disclaimer, width) as string[];
    doc.text(lines, margin, 277);
    doc.text('ScreenWise Wellness | Page ' + p + ' of ' + pages, margin, 292);
  }
  const reportDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.period.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(data.generatedAt));
  doc.save('ScreenWise_Wellness_Report_' + reportDay + '.pdf');
}
