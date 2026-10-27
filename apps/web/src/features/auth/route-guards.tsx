import { Navigate, Outlet, useLocation, Link } from 'react-router';
import { useAuth } from './auth-provider';
import { LoadingState, EmptyState } from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function destination(
  profile: { role: string; onboarding_completed: boolean } | null,
) {
  return !profile?.onboarding_completed
    ? '/onboarding'
    : profile.role === 'ADMIN'
      ? '/admin'
      : '/dashboard';
}
export function safeDestination(value: unknown) {
  return typeof value === 'string' &&
    /^\/(dashboard|assessments|wellness-plan|prevention|library|progress|goals|settings|admin)(\/[^?#\\]*)?$/.test(
      value,
    )
    ? value
    : null;
}
function ProfileError() {
  const { error, refreshProfile, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-xl p-8">
      <EmptyState
        title="Unable to load your account"
        description={error ?? 'Please retry.'}
      >
        <div className="flex gap-3">
          <Button
            onClick={() =>
              void refreshProfile().catch((e) => toast.error(errorMessage(e)))
            }
          >
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void signOut().catch((e) => toast.error(errorMessage(e)))
            }
          >
            Sign out
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}
export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isLoading) return <LoadingState />;
  if (!auth.isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!auth.profile || auth.error) return <ProfileError />;
  if (auth.recovery) return <Navigate to="/reset-password" replace />;
  return <Outlet />;
}
export function PublicOnlyRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isLoading) return <LoadingState />;
  if (auth.isAuthenticated) {
    if (!auth.profile || auth.error) return <ProfileError />;
    return (
      <Navigate
        replace
        to={
          auth.recovery
            ? '/reset-password'
            : auth.profile.onboarding_completed
              ? (safeDestination(location.state?.from) ??
                destination(auth.profile))
              : '/onboarding'
        }
      />
    );
  }
  return <Outlet />;
}
export function OnboardingGuard() {
  const { profile } = useAuth();
  return profile?.onboarding_completed ? (
    <Outlet />
  ) : (
    <Navigate to="/onboarding" replace />
  );
}
export function AdminRoute() {
  const { profile } = useAuth();
  return profile?.role === 'ADMIN' ? (
    <Outlet />
  ) : (
    <div className="mx-auto max-w-xl p-10">
      <EmptyState
        title="Access denied"
        description="Your account does not have administrator access."
      >
        <Link to="/dashboard" className="text-primary underline">
          Back to dashboard
        </Link>
      </EmptyState>
    </div>
  );
}
