import { test, expect, type Page } from '@playwright/test';

// Isolated UI fixtures: real components/router, intercepted identity and HTTP.
// Persistence and authorization are exercised separately against PostgreSQL.
const userId = '50000000-0000-4000-8000-000000000001';
const eyeId = '40000000-0000-4000-8000-000000000001';
const moveId = '40000000-0000-4000-8000-000000000007';
const today = '2026-10-18';
const timestamp = today + 'T04:00:00.000Z';
const activities = [
  {
    id: eyeId,
    title: '20–20–20 visual break',
    slug: '20-20-20-visual-break',
    category: 'EYE_COMFORT',
    duration_seconds: 20,
  },
  {
    id: moveId,
    title: 'Standing break',
    slug: 'standing-break',
    category: 'MOVEMENT',
    duration_seconds: 60,
  },
].map((a) => ({
  ...a,
  description: 'A short opportunity to pause your digital routine.',
  instructions: [
    'Pause your current task.',
    'Move within a comfortable range.',
    'Return when you feel ready.',
  ],
  benefits: ['An opportunity to pause.'],
  safety_notes: 'Stop if you feel pain or discomfort.',
  icon: null,
  image_url: null,
  difficulty: 'EASY',
  is_active: true,
  created_at: timestamp,
  updated_at: timestamp,
}));

async function setup(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date(timestamp) });
  const identity = {
    user: { id: userId, email: 'fixture@example.test' },
    profile: {
      id: userId,
      full_name: 'Wellness tester',
      email: 'fixture@example.test',
      role: 'ADMIN',
      avatar_url: null,
      onboarding_completed: true,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    recovery: false,
  };
  await page.route('**/src/features/auth/auth-provider.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const identity = ${JSON.stringify(identity)}; export function AuthProvider({children}) {return children;} export function useAuth() { return {...identity, signOut: async()=>{}, refreshProfile: async()=>{}}; }`,
    }),
  );
  let prefs = {
    notifications_enabled: false,
    timezone: 'Asia/Kolkata',
    theme: 'light',
  };
  const sessions: Record<string, unknown>[] = [];
  const goals: Record<string, unknown>[] = [];
  const reminders: Record<string, unknown>[] = [];
  const notifications = [
    {
      id: '50000000-0000-4000-8000-000000000002',
      title: 'A moment to pause',
      message: 'Review your wellness routine.',
      type: 'WELLNESS_TIP',
      is_read: false,
      created_at: timestamp,
      scheduled_for: null,
    },
  ];
  const progress = (g: Record<string, unknown>) => {
    const count = sessions.filter(
      (s) =>
        s.status === 'COMPLETED' &&
        (g.activity_ids as string[]).includes(s.activity_id as string),
    ).length;
    return {
      count,
      target: g.target_count,
      percentage: Math.min(100, (count / Number(g.target_count)) * 100),
      currentStreak: count >= Number(g.target_count) ? 1 : 0,
      longestStreak: count >= Number(g.target_count) ? 1 : 0,
      streakUnit: 'days',
      periodStart: today,
      periodEnd: today,
      history: [
        {
          date: today,
          count,
          target: g.target_count,
          met: count >= Number(g.target_count),
          paused: false,
        },
      ],
    };
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace('/api/v1', ''),
      method = req.method();
    const body = method === 'GET' ? {} : (req.postDataJSON() ?? {});
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    const list = (data: unknown[]) =>
      route.fulfill({
        json: {
          success: true,
          data,
          meta: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
        },
      });
    if (path === '/users/preferences') {
      if (method === 'PATCH') prefs = { ...prefs, ...body };
      return ok(prefs);
    }
    if (path === '/users/me') return ok(identity.profile);
    if (path === '/reminders/poll') return ok([]);
    if (path === '/activities/today')
      return ok({
        date: url.searchParams.get('date') ?? today,
        timezone: prefs.timezone,
        recordedPlan: true,
        activities,
        sessions,
        completedActivityIds: sessions
          .filter((s) => s.status === 'COMPLETED')
          .map((s) => s.activity_id),
        goals: goals.map((g) => ({ ...g, progress: progress(g) })),
      });
    if (path === '/activities/history') return list(sessions);
    if (/^\/activities\/sessions\//.test(path)) {
      const s = sessions.find((s) => s.id === path.split('/').at(-1))!;
      Object.assign(s, {
        status: body.status,
        completed_at: body.status === 'COMPLETED' ? timestamp : null,
        duration_seconds: body.status === 'COMPLETED' ? 20 : null,
      });
      return ok(s);
    }
    if (/^\/activities\/[^/]+\/sessions$/.test(path)) {
      const a = activities.find((a) => a.id === path.split('/')[2])!;
      const s = {
        id: crypto.randomUUID(),
        user_id: userId,
        activity_id: a.id,
        activity_snapshot: a,
        started_at: timestamp,
        completed_at: null,
        duration_seconds: null,
        status: 'STARTED',
        source: body.source,
      };
      sessions.push(s);
      return ok(s);
    }
    if (path === '/activities' || path === '/admin/activities')
      return list(
        activities.filter(
          (a) =>
            (!url.searchParams.get('category') ||
              a.category === url.searchParams.get('category')) &&
            (!url.searchParams.get('search') ||
              a.title
                .toLowerCase()
                .includes(url.searchParams.get('search')!.toLowerCase())),
        ),
      );
    if (path.startsWith('/activities/'))
      return ok(activities.find((a) => a.id === path.split('/').at(-1)));
    if (path === '/goals/summary')
      return ok({
        goals: goals.map((g) => ({ ...g, progress: progress(g) })),
        interests: ['screen_breaks'],
      });
    if (path === '/goals' && method === 'POST') {
      const g = {
        ...body,
        id: crypto.randomUUID(),
        user_id: userId,
        status: 'ACTIVE',
        tracking_start: today,
        pause_ranges: [],
        definition_history: [],
        created_at: timestamp,
        updated_at: timestamp,
      };
      goals.push(g);
      return ok({ ...g, progress: progress(g) });
    }
    if (path === '/goals')
      return list(
        goals
          .filter(
            (g) =>
              !url.searchParams.get('status') ||
              g.status === url.searchParams.get('status'),
          )
          .map((g) => ({ ...g, progress: progress(g) })),
      );
    if (path.startsWith('/goals/')) {
      const g = goals.find((g) => g.id === path.split('/').at(-1))!;
      Object.assign(g, body);
      return ok({ ...g, progress: progress(g) });
    }
    if (path === '/reminders' && method === 'POST') {
      const r = { ...body, id: crypto.randomUUID(), created_at: timestamp };
      reminders.push(r);
      return ok(r);
    }
    if (path === '/reminders') return ok(reminders);
    if (path === '/notifications/unread-count')
      return ok({ count: notifications.filter((n) => !n.is_read).length });
    if (path === '/notifications/read-all') {
      notifications.forEach((n) => {
        n.is_read = true;
      });
      return ok({ updated: notifications.length });
    }
    if (/^\/notifications\/.+\/read$/.test(path)) {
      notifications[0]!.is_read = true;
      return ok(notifications[0]);
    }
    if (path === '/notifications')
      return list(
        notifications.filter(
          (n) => url.searchParams.get('unread') !== 'true' || !n.is_read,
        ),
      );
    return route.fulfill({
      status: 404,
      json: {
        success: false,
        error: {
          code: 'UI_FIXTURE_MISSING',
          message: 'No fixture for ' + path,
        },
      },
    });
  });
  return { errors, sessions, goals, reminders };
}

test('guided completion updates checklist; desktop/mobile icons and labels align', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/prevention');
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await expect(page.getByLabel('Activity category')).toHaveValue('MOVEMENT');
  const alignment = await page
    .locator('aside nav a')
    .evaluateAll((links) =>
      links.every(
        (a) =>
          getComputedStyle(a).display === 'flex' &&
          Math.abs(
            a.querySelector('svg')!.getBoundingClientRect().y +
              10 -
              (a.querySelector('span')!.getBoundingClientRect().y +
                a.querySelector('span')!.getBoundingClientRect().height / 2),
          ) < 1,
      ),
    );
  expect(alignment).toBe(true);
  await page.goto('/prevention/' + moveId + '?source=CHECKLIST');
  await page
    .getByRole('button', { name: 'Start activity', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Step 1 of 3' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Previous step' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page
    .getByRole('button', { name: 'Complete activity', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm completion' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your completion is saved.' }),
  ).toBeVisible();
  expect(state.sessions[0]?.status).toBe('COMPLETED');
  await page.goto('/prevention/daily-checklist');
  await expect(page.getByText('Completed on ' + today)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Goals', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(state.errors).toEqual([]);
});

test('eye timer pauses, restores conservatively, survives navigation, and saves only on confirmation', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/prevention');
  await page.getByLabel('Focus interval (5').fill('5');
  await page.getByRole('button', { name: 'Start focus timer' }).click();
  await page.clock.fastForward(10000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await page.getByRole('timer').textContent();
  await page.clock.fastForward(10000);
  await expect(page.getByRole('timer')).toHaveText(paused!);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page
    .locator('aside')
    .getByRole('link', { name: 'Goals', exact: true })
    .click();
  await page.clock.fastForward(300000);
  await page
    .locator('aside')
    .getByRole('link', { name: 'Prevention', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start 20-second break' }).click();
  await expect(
    page.getByRole('button', { name: 'I took this break' }),
  ).not.toBeVisible();
  await page.clock.fastForward(21000);
  expect(state.sessions[0]?.status).toBe('STARTED');
  await page.getByRole('button', { name: 'I took this break' }).click();
  await expect(
    page.getByRole('button', { name: 'Start focus timer' }),
  ).toBeVisible();
  expect(state.sessions[0]?.status).toBe('COMPLETED');
  expect(state.errors).toEqual([]);
});

test('goal lifecycle, reminder settings, timezone validation, and notification read controls work', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('My daily movement');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(
    page.getByText('Choose at least one activity to track this goal.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Standing break', { exact: true }).check();
  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(
    page.getByRole('heading', { name: 'My daily movement' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'PAUSED', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'ACTIVE', exact: true }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Archive', exact: true })
    .click();
  await page.getByRole('button', { name: 'ARCHIVED', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My daily movement' }),
  ).toBeVisible();
  expect(state.goals[0]?.status).toBe('ARCHIVED');
  await page.goto('/settings/reminders');
  const initialPermission = await page.evaluate(() => Notification.permission);
  if (initialPermission === 'denied') {
    await expect(
      page.getByText('Notifications are blocked.', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enable browser notifications' }),
    ).toBeDisabled();
  }
  // Native headless permission policy may stay denied even after granting.
  // Isolate the explicit permission-request UI contract from that policy.
  await page.addInitScript(() => {
    const state = {
      permission: 'default' as NotificationPermission,
      requests: 0,
    };
    class TestNotification {
      static get permission() {
        return state.permission;
      }
      static async requestPermission() {
        state.requests++;
        state.permission = 'granted';
        return state.permission;
      }
      static get requestCount() {
        return state.requests;
      }
    }
    Object.defineProperty(window, 'Notification', {
      value: TestNotification,
      configurable: true,
    });
  });
  await page.reload();
  expect(
    await page.evaluate(
      () => (Notification as unknown as { requestCount: number }).requestCount,
    ),
  ).toBe(0);
  await page
    .getByRole('button', { name: 'Enable browser notifications' })
    .click();
  expect(
    await page.evaluate(
      () => (Notification as unknown as { requestCount: number }).requestCount,
    ),
  ).toBe(1);
  await expect(
    page.getByText('Browser permission: granted.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enable browser notifications' }),
  ).toBeDisabled();
  await page.getByLabel('Daily checklist timezone').fill('Invalid/Timezone');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Choose a valid IANA timezone',
  );
  await page.getByLabel('Daily checklist timezone').fill('Europe/London');
  await page.getByRole('button', { name: 'Save timezone' }).click();
  await page.getByRole('button', { name: 'Add reminder' }).click();
  await page.getByRole('button', { name: 'Save reminder' }).click();
  await expect(page.getByRole('heading', { name: 'EYE BREAK' })).toBeVisible();
  expect(state.reminders).toHaveLength(1);
  await page.getByRole('button', { name: 'Notifications, 1 unread' }).click();
  await page
    .getByRole('menuitem', { name: 'Mark all as read', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Notifications, 0 unread' }),
  ).toBeVisible();
  await page.goto('/notifications');
  await page.getByLabel('Unread only').check();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(
    page.getByRole('heading', { name: "You're all caught up" }),
  ).toBeVisible();
  expect(state.errors).toEqual([]);
});
