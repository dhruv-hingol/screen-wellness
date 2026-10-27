import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// Explicit browser-only identity/HTTP fixtures. SQL ownership/aggregation is
// checked separately against the real migrations in phase6.test.mjs.
async function setup(page: Page, role = 'USER') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const identity = {
    user: {
      id: '50000000-0000-4000-8000-000000000001',
      email: 'fixture@example.test',
    },
    profile: {
      id: '50000000-0000-4000-8000-000000000001',
      full_name: 'Wellness Tester',
      role,
      onboarding_completed: true,
      avatar_url: null,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    recovery: false,
  };
  await page.route('**/src/features/auth/auth-provider.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const identity=${JSON.stringify(identity)};export function AuthProvider({children}){return children;}export function useAuth(){return {...identity,signOut:async()=>{},refreshProfile:async()=>{}};}`,
    }),
  );
  const requests: URL[] = [];
  const period = {
    startDate: '2026-10-20',
    endDate: '2026-10-26',
    timezone: 'Asia/Kolkata',
  };
  const point = {
    id: 'result-1',
    assessmentId: 'assessment-1',
    title: 'Eye comfort check',
    category: 'EYE_COMFORT',
    date: '2026-10-25T10:00:00Z',
    score: 40,
    feedback: 'Moderate reported concern',
    explanation: 'Your answers suggest considering comfortable visual breaks.',
    compatibilityKey: 'eye-v1',
    version: 1,
  };
  const streak = {
    current: 3,
    longest: 5,
    unit: 'days',
    goalId: 'goal-1',
    goalTitle: 'Daily visual breaks',
  };
  const goal = {
    id: 'goal-1',
    title: 'Daily visual breaks',
    status: 'ACTIVE',
    period: 'DAILY',
    timezone: period.timezone,
    count: 2,
    target: 3,
    percentage: 67,
    periodStart: '2026-10-26',
    periodEnd: '2026-10-26',
    currentStreak: 3,
    longestStreak: 5,
    streakUnit: 'days',
    history: [
      { date: '2026-10-25', count: 3, target: 3, met: true, paused: false },
      { date: '2026-10-26', count: 2, target: 3, met: false, paused: false },
    ],
  };
  const data = {
    period,
    generatedAt: '2026-10-26T10:00:00Z',
    fullName: 'Wellness Tester',
    overview: {
      assessments: 2,
      activities: 5,
      activeGoals: 1,
      goalCompletionPercentage: 50,
    },
    daily: [
      { date: '2026-10-25', count: 3 },
      { date: '2026-10-26', count: 2 },
    ],
    distribution: [{ category: 'EYE_COMFORT', count: 5 }],
    assessments: [
      {
        assessmentId: point.assessmentId,
        title: point.title,
        category: point.category,
        compatibilityKey: point.compatibilityKey,
        points: [
          { ...point, id: 'previous', date: '2026-10-21T10:00:00Z', score: 50 },
          point,
        ],
      },
    ],
    assessmentHistory: { rows: [point], total: 2, page: 1, pageSize: 20 },
    goals: {
      rows: [goal],
      active: 1,
      achieved: 1,
      pending: 1,
      completionPercentage: 50,
    },
    streak,
    timeline: {
      rows: [
        {
          id: 'session-1',
          kind: 'activity',
          title: 'A short visual pause',
          category: 'EYE_COMFORT',
          date: '2026-10-26T08:00:00Z',
          durationSeconds: 20,
        },
      ],
      total: 21,
      page: 1,
      pageSize: 20,
    },
  };
  let fail = false,
    empty = false;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const path = url.pathname;
    if (fail && path === '/api/v1/analytics/dashboard') {
      await route.fulfill({
        status: 503,
        json: {
          success: false,
          error: { message: 'Analytics temporarily unavailable' },
        },
      });
      return;
    }
    let payload: unknown = [];
    if (path === '/api/v1/dashboard/summary')
      payload = {
        period,
        latestAssessment: point,
        todayActivities: { completed: 2, target: 3, plannedCompleted: 2 },
        activeGoals: 1,
        achievedGoals: 1,
        streak,
      };
    if (
      path === '/api/v1/analytics/dashboard' ||
      path === '/api/v1/analytics/report-data'
    ) {
      const range = {
        ...period,
        startDate: url.searchParams.get('startDate') ?? period.startDate,
        endDate: url.searchParams.get('endDate') ?? period.endDate,
      };
      payload = {
        ...data,
        period: range,
        timeline: {
          ...data.timeline,
          page: Number(url.searchParams.get('page') ?? 1),
        },
        recommendations: [],
      };
      if (empty)
        payload = {
          ...data,
          period: range,
          overview: {
            assessments: 0,
            activities: 0,
            activeGoals: 0,
            goalCompletionPercentage: 0,
          },
          daily: [],
          distribution: [],
          assessments: [],
          goals: {
            rows: [],
            active: 0,
            achieved: 0,
            pending: 0,
            completionPercentage: 0,
          },
          timeline: { rows: [], total: 0, page: 1, pageSize: 20 },
        };
    }
    if (path.endsWith('/unread-count')) payload = { count: 0 };
    if (path === '/api/v1/admin/analytics/dashboard')
      payload = {
        period,
        suppressionThreshold: 5,
        activeUserDefinition:
          'Completed an assessment or activity in this period.',
        overview: {
          users: 8,
          activeUsers: { value: null, suppressed: true },
          assessments: { value: null, suppressed: true },
          activities: { value: null, suppressed: true },
          publishedArticles: 12,
          activeActivities: 16,
        },
        users: [],
        assessments: [{ label: 'EYE_COMFORT', value: null, suppressed: true }],
        activities: [],
        content: [{ label: 'PUBLISHED', value: 12, suppressed: false }],
        engagement: [],
      };
    await route.fulfill({
      json: {
        success: true,
        data: payload,
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      },
    });
  });
  return {
    requests,
    errors,
    setFail: (v: boolean) => {
      fail = v;
    },
    setEmpty: (v: boolean) => {
      empty = v;
    },
  };
}
test('Phase 6 dashboard, date filters, pagination and a real PDF download', async ({
  page,
}, testInfo) => {
  const fixture = await setup(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Wellness$/ })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Latest assessment' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'View result' })).toHaveAttribute(
    'href',
    '/assessments/results/result-1',
  );
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your wellness progress' }),
  ).toBeVisible();
  await page.getByLabel('Reporting range').selectOption('7d');
  await page.getByRole('button', { name: 'Apply range' }).click();
  await expect
    .poll(() =>
      fixture.requests.some(
        (u) =>
          u.pathname.endsWith('/analytics/dashboard') &&
          u.searchParams.get('range') === '7d',
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect
    .poll(() =>
      fixture.requests.some((u) => u.searchParams.get('page') === '2'),
    )
    .toBe(true);
  await page.getByLabel('Reporting range').selectOption('custom');
  await page.getByLabel('From', { exact: true }).fill('2026-10-01');
  await page.getByLabel('To', { exact: true }).fill('2026-10-26');
  await page.getByRole('button', { name: 'Apply range' }).click();
  await expect
    .poll(() =>
      fixture.requests.some(
        (u) => u.searchParams.get('startDate') === '2026-10-01',
      ),
    )
    .toBe(true);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report (PDF)' }).click();
  const download = await pending;
  const path = testInfo.outputPath('wellness-report.pdf');
  await download.saveAs(path);
  const pdf = await readFile(path);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(2000);
  expect(download.suggestedFilename()).toBe(
    'ScreenWise_Wellness_Report_2026-10-26.pdf',
  );
  expect(
    fixture.requests.some(
      (u) =>
        u.pathname.endsWith('/report-data') &&
        u.searchParams.get('startDate') === '2026-10-01' &&
        u.searchParams.get('endDate') === '2026-10-26',
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole('heading', { name: 'Your wellness progress' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(fixture.errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('progress-mobile.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 320 });
  await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  const mobileNavigation = page.locator(
    '[aria-label="Scrollable mobile navigation"]',
  );
  await mobileNavigation
    .getByRole('link', { name: 'Settings', exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await mobileNavigation.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1024, height: 400 });
  const sidebar = page.locator(
    '[aria-label="Scrollable workspace navigation"]',
  );
  await sidebar
    .getByRole('link', { name: 'Settings', exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await sidebar.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  const menu = await page.getByRole('menu').boundingBox();
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(1024);
  await page.screenshot({
    path: testInfo.outputPath('account-dropdown-dark.png'),
  });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Account menu' }),
  ).toBeFocused();
  expect(fixture.errors).toEqual([]);
});
test('Phase 6 empty and failed analytics states are actionable', async ({
  page,
}) => {
  const fixture = await setup(page);
  fixture.setEmpty(true);
  await page.goto('/progress');
  await expect(page.getByText('No category data yet.')).toBeVisible();
  fixture.setFail(true);
  await page.reload();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Analytics temporarily unavailable' }),
  ).toBeVisible({ timeout: 15000 });
  fixture.setFail(false);
  await page.getByRole('button', { name: 'Retry loading data' }).click();
  await expect(page.getByText('No category data yet.')).toBeVisible();
  expect(fixture.errors).toEqual([]);
});
test('Phase 6 admin suppression UI and non-admin route guard', async ({
  page,
}) => {
  const fixture = await setup(page, 'ADMIN');
  await page.goto('/admin/analytics');
  await expect(
    page.getByRole('heading', { name: 'Platform analytics' }),
  ).toBeVisible();
  await expect(
    page.getByText('Hidden to protect small groups.', { exact: false }),
  ).toBeVisible();
  expect(fixture.errors).toEqual([]);
  await page.unrouteAll();
  await setup(page, 'USER');
  await page.goto('/admin/analytics');
  await expect(
    page.getByRole('heading', { name: 'Access denied' }),
  ).toBeVisible();
});

test('onboarding validates every step with readable errors and preserves native dropdown behavior', async ({
  page,
}, testInfo) => {
  const fixture = await setup(page);
  await page.route('**/api/v1/users/onboarding', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            full_name: '',
            occupation: null,
            onboarding_completed: false,
          },
          preferences: {
            age_range: null,
            primary_device: null,
            daily_screen_hours: null,
            usage_purpose: null,
            break_frequency: null,
            sleep_time: null,
            wake_time: null,
          },
          goals: [],
        },
      },
    }),
  );
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByText('Choose a valid option for occupation.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel(/Full name/).fill('Asha Tester');
  await page
    .getByRole('combobox', { name: /Occupation/ })
    .selectOption('Student');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'Device usage' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByText('Enter a valid number for daily screen time.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: /Primary device/ })
    .selectOption('Smartphone');
  await page.getByLabel(/Average daily screen hours/).fill('25');
  await page
    .getByRole('combobox', { name: /Main reason/ })
    .selectOption('Study');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByText('Enter 24 or less for daily screen time.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel(/Average daily screen hours/).fill('6');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'Digital habits' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByText('Choose a valid option for break frequency.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: /Break frequency/ })
    .selectOption('Every hour');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'Wellness goals' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save and finish' }).click();
  await expect(
    page.getByText('Choose at least one goal', { exact: true }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Improve posture habits' }).check();
  await page.getByRole('button', { name: 'Save and finish' }).click();
  await expect(
    page.getByRole('heading', { name: 'You are ready' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 500 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('onboarding-complete.png'),
    fullPage: true,
  });
  expect(fixture.errors).toEqual([]);
});
