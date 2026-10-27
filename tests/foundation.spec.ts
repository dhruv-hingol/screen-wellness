import { test, expect } from '@playwright/test';
test('public health and unauthenticated APIs fail closed', async ({
  request,
}) => {
  const response = await request.get('/api/v1/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: { status: 'ok', service: 'screenwise-api' },
  });
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  for (const route of [
    '/users/me',
    '/users/preferences',
    '/users/onboarding',
    '/users/wellness-goals',
    '/admin/access',
    '/assessments',
    '/assessments/history',
    '/recommendations/me',
    '/admin/assessments',
    '/admin/recommendations',
    '/activities',
    '/activities/history',
    '/activities/today',
    '/goals',
    '/goals/summary',
    '/reminders',
    '/notifications',
    '/notifications/unread-count',
    '/admin/activities',
    '/articles',
    '/articles/categories',
    '/articles/tags',
    '/bookmarks',
    '/admin/articles',
    '/admin/categories',
    '/admin/tags',
    '/admin/media',
    '/admin/content/summary',
    '/dashboard/summary',
    '/dashboard/weekly-activity',
    '/dashboard/recommendations',
    '/dashboard/recent-activity',
    '/dashboard/goals',
    '/analytics/overview',
    '/analytics/assessments',
    '/analytics/activities',
    '/analytics/activity-distribution',
    '/analytics/goals',
    '/analytics/streaks',
    '/analytics/timeline',
    '/analytics/report-data',
    '/analytics/dashboard',
    '/admin/analytics/overview',
    '/admin/analytics/users',
    '/admin/analytics/assessments',
    '/admin/analytics/activities',
    '/admin/analytics/content',
    '/admin/analytics/engagement',
    '/admin/analytics/dashboard',
  ]) {
    const result = await request.get('/api/v1' + route);
    expect(result.status()).toBe(401);
    expect((await result.json()).error.code).toBe('UNAUTHENTICATED');
  }
  const patch = await request.patch('/api/v1/users/me', {
    data: { role: 'ADMIN' },
  });
  expect(patch.status()).toBe(401);
  const malformed = await request.post('/api/v1/users/onboarding', {
    headers: { 'Content-Type': 'application/json' },
    data: '{',
  });
  expect(malformed.status()).toBe(400);
});
test('all private routes redirect to sign in without render errors', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    '/dashboard',
    '/assessments',
    '/assessments/example',
    '/assessments/history',
    '/assessments/results/example',
    '/wellness-plan',
    '/prevention',
    '/prevention/daily-checklist',
    '/prevention/history',
    '/prevention/40000000-0000-4000-8000-000000000001',
    '/settings/reminders',
    '/notifications',
    '/library',
    '/library/example',
    '/library/bookmarks',
    '/admin/categories',
    '/admin/articles/new',
    '/admin/articles/61000000-0000-4000-8000-000000000001/edit',
    '/admin/articles/61000000-0000-4000-8000-000000000001/preview',
    '/progress',
    '/goals',
    '/settings',
    '/onboarding',
    '/admin',
    '/admin/users',
    '/admin/assessments',
    '/admin/assessments/new',
    '/admin/assessments/example/edit',
    '/admin/articles',
    '/admin/activities',
    '/admin/recommendations',
    '/admin/analytics',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL('/login');
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('auth forms, recovery error and missing configuration are honest', async ({
  page,
}) => {
  await page.goto('/signup');
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Confirm password', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await page.goto('/forgot-password');
  await expect(
    page.getByRole('heading', { name: 'Forgot your password?' }),
  ).toBeVisible();
  await page.goto('/reset-password');
  await expect(
    page.getByText('This recovery link is invalid or expired.'),
  ).toBeVisible();
  await page.goto('/login');
  if (await page.getByText(/Authentication is not configured/).isVisible())
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeDisabled();
});
test('responsive public navigation and theme remain functional', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  for (const route of ['/', '/login', '/signup', '/forgot-password']) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});
