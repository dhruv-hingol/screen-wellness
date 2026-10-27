import { PreventionPage } from '@/features/prevention/pages/prevention-page';
import { LibraryPage } from '@/features/library/pages/library-page';
import { ArticlePage } from '@/features/library/pages/article-page';
import { BookmarksPage } from '@/features/library/pages/bookmarks-page';
import {
  AdminArticlesPage,
  AdminArticlePreviewPage,
} from '@/features/admin/articles/pages/admin-articles-page';
import { lazy, Suspense } from 'react';
const ArticleEditorPage = lazy(() =>
  import('@/features/admin/articles/pages/article-editor-page').then((m) => ({
    default: m.ArticleEditorPage,
  })),
);
import { AdminCategoriesPage } from '@/features/admin/categories/categories-page';
import { ContentOverviewPage } from '@/features/admin/dashboard/content-overview-page';
import { ActivityDetailPage } from '@/features/prevention/pages/activity-detail-page';
import { DailyChecklistPage } from '@/features/prevention/pages/checklist-page';
import { ActivityHistoryPage } from '@/features/prevention/pages/activity-history-page';
import { GoalsPage } from '@/features/goals/pages/goals-page';
import { NotificationsPage } from '@/features/notifications/pages/notifications-page';
import { ReminderSettingsPage } from '@/features/notifications/pages/reminder-settings-page';
import { AdminActivitiesPage } from '@/features/admin/activities/admin-activities-page';
import { AssessmentListPage } from '@/features/assessments/pages/assessment-list-page';
import { QuestionnairePage } from '@/features/assessments/pages/questionnaire-page';
import { AssessmentResultPage } from '@/features/assessments/pages/result-page';
import { AssessmentHistoryPage } from '@/features/assessments/pages/history-page';
import { WellnessPlanPage } from '@/features/recommendations/pages/wellness-plan-page';
import { AdminAssessmentsPage } from '@/features/admin/assessments/admin-assessments-page';
import { AssessmentBuilderPage } from '@/features/admin/assessments/assessment-builder-page';
import { RuleManagementPage } from '@/features/admin/recommendations/rule-management-page';
import { createBrowserRouter, Link } from 'react-router';
import { PublicLayout } from '@/app/layouts/public-layout';
import { WorkspaceLayout } from '@/app/layouts/workspace-layout';
import { LandingPage } from '@/features/dashboard/landing-page';
const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({
    default: m.DashboardPage,
  })),
);
const ProgressPage = lazy(() =>
  import('@/features/progress/pages/progress-page').then((m) => ({
    default: m.ProgressPage,
  })),
);
const AdminAnalyticsPage = lazy(() =>
  import('@/features/admin/analytics/pages/admin-analytics-page').then((m) => ({
    default: m.AdminAnalyticsPage,
  })),
);
import {
  ComingSoon,
  EmptyState,
  LoadingState,
} from '@/components/common/page-elements';
import { AuthPage } from '@/features/auth/pages/auth-page';
import { CallbackPage } from '@/features/auth/pages/callback-page';
import {
  ProtectedRoute,
  PublicOnlyRoute,
  AdminRoute,
  OnboardingGuard,
} from '@/features/auth/route-guards';
import { OnboardingPage } from '@/features/onboarding/pages/onboarding-page';
import { SettingsPage } from '@/features/profile/pages/settings-page';
const admin = [['users', 'Users']];
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: <AuthPage mode="login" /> },
          { path: 'signup', element: <AuthPage mode="signup" /> },
          {
            path: 'forgot-password',
            element: <AuthPage mode="forgot-password" />,
          },
        ],
      },
      { path: 'reset-password', element: <AuthPage mode="reset-password" /> },
      { path: 'auth/callback', element: <CallbackPage /> },
      {
        path: '*',
        element: (
          <div className="mx-auto max-w-3xl p-10">
            <EmptyState
              title="Page not found"
              description="This address does not belong to ScreenWise."
            >
              <Link to="/" className="text-primary underline">
                Return home
              </Link>
            </EmptyState>
          </div>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: 'onboarding', element: <OnboardingPage /> },
      {
        element: <OnboardingGuard />,
        children: [
          {
            element: <WorkspaceLayout />,
            children: [
              {
                path: 'dashboard',
                element: (
                  <Suspense fallback={<LoadingState />}>
                    <DashboardPage />
                  </Suspense>
                ),
              },
              {
                path: 'progress',
                element: (
                  <Suspense fallback={<LoadingState />}>
                    <ProgressPage />
                  </Suspense>
                ),
              },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'prevention', element: <PreventionPage /> },
              { path: 'library', element: <LibraryPage /> },
              { path: 'library/bookmarks', element: <BookmarksPage /> },
              { path: 'library/:slug', element: <ArticlePage /> },
              {
                path: 'prevention/daily-checklist',
                element: <DailyChecklistPage />,
              },
              { path: 'prevention/history', element: <ActivityHistoryPage /> },
              {
                path: 'prevention/:activityId',
                element: <ActivityDetailPage />,
              },
              { path: 'goals', element: <GoalsPage /> },
              { path: 'settings/reminders', element: <ReminderSettingsPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: 'assessments', element: <AssessmentListPage /> },
              {
                path: 'assessments/history',
                element: <AssessmentHistoryPage />,
              },
              {
                path: 'assessments/results/:attemptId',
                element: <AssessmentResultPage />,
              },
              { path: 'assessments/:id', element: <QuestionnairePage /> },
              { path: 'wellness-plan', element: <WellnessPlanPage /> },
            ],
          },
          {
            element: <AdminRoute />,
            children: [
              {
                path: 'admin',
                element: <WorkspaceLayout admin />,
                children: [
                  { index: true, element: <ContentOverviewPage /> },
                  {
                    path: 'analytics',
                    element: (
                      <Suspense fallback={<LoadingState />}>
                        <AdminAnalyticsPage />
                      </Suspense>
                    ),
                  },
                  { path: 'articles', element: <AdminArticlesPage /> },
                  {
                    path: 'articles/new',
                    element: (
                      <Suspense fallback={<LoadingState />}>
                        <ArticleEditorPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'articles/:id/edit',
                    element: (
                      <Suspense fallback={<LoadingState />}>
                        <ArticleEditorPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: 'articles/:id/preview',
                    element: <AdminArticlePreviewPage />,
                  },
                  { path: 'categories', element: <AdminCategoriesPage /> },
                  { path: 'activities', element: <AdminActivitiesPage /> },
                  { path: 'assessments', element: <AdminAssessmentsPage /> },
                  {
                    path: 'assessments/new',
                    element: <AssessmentBuilderPage />,
                  },
                  {
                    path: 'assessments/:id/edit',
                    element: <AssessmentBuilderPage />,
                  },
                  { path: 'recommendations', element: <RuleManagementPage /> },
                  ...admin.map(([path, title]) => ({
                    path,
                    element: <ComingSoon title={title!} />,
                  })),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
