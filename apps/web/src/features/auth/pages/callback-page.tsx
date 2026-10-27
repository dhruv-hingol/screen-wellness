import { Navigate, Link } from 'react-router';
import { useAuth } from '../auth-provider';
import { destination } from '../route-guards';
import { LoadingState, EmptyState } from '@/components/common/page-elements';
export function CallbackPage() {
  const auth = useAuth();
  if (auth.isLoading) return <LoadingState />;
  if (auth.user && auth.profile)
    return (
      <Navigate
        replace
        to={auth.recovery ? '/reset-password' : destination(auth.profile)}
      />
    );
  return (
    <div className="mx-auto max-w-xl p-10">
      <EmptyState
        title="Confirm your account"
        description={
          auth.error ??
          'If your email was confirmed, sign in to continue. An expired link or a link opened in a different browser may require signing in again.'
        }
      >
        <Link to="/login" className="text-primary underline">
          Go to login
        </Link>
      </EmptyState>
    </div>
  );
}
