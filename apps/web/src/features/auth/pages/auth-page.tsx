import { FieldError } from '@/components/common/form-errors';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  signupSchema,
  loginSchema,
  resetPasswordSchema,
} from '@screenwise/shared';
import { useAuth } from '../auth-provider';
import { requireSupabase, authConfigured } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Brand } from '@/components/layout/brand';
import { LoadingState } from '@/components/common/page-elements';
type Mode = 'login' | 'signup' | 'forgot-password' | 'reset-password';
const titles = {
  login: 'Welcome back',
  signup: 'Make room for a healthier you',
  'forgot-password': 'Forgot your password?',
  'reset-password': 'Set a new password',
};
function formSchema(mode: Mode) {
  return z
    .object({
      fullName: z.string(),
      email: z.string(),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((value, ctx) => {
      const result = (
        mode === 'signup'
          ? signupSchema
          : mode === 'login'
            ? loginSchema
            : mode === 'forgot-password'
              ? z.object({ email: z.email() })
              : resetPasswordSchema
      ).safeParse(value);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({
            code: 'custom',
            path: issue.path,
            message: issue.message,
          });
    });
}
export function AuthPage({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema(mode)),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  const submit = handleSubmit(async (values) => {
    setFailure('');
    setNotice('');
    try {
      if (mode === 'login') {
        await auth.signIn(values.email, values.password);
        toast.success('Signed in');
      } else if (mode === 'signup') {
        const session = await auth.signUp(
          values.fullName,
          values.email,
          values.password,
        );
        if (!session)
          setNotice(
            'Check your email to confirm your account. Open the confirmation link in this browser, then return to sign in.',
          );
      } else if (mode === 'forgot-password') {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(
          values.email,
          { redirectTo: window.location.origin + '/reset-password' },
        );
        if (error) throw error;
        setNotice(
          'If an account exists for this address, you will receive a password-reset email. Open the link in this browser.',
        );
      } else {
        if (!auth.recovery || !auth.user)
          throw new Error(
            'This recovery link is invalid or expired. Request a new link.',
          );
        const { error } = await requireSupabase().auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        auth.finishRecovery();
        await auth.signOut();
        toast.success('Password updated. Sign in with your new password.');
        navigate('/login', { replace: true });
      }
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  if (mode === 'reset-password' && auth.isLoading) return <LoadingState />;
  const invalidRecovery =
    mode === 'reset-password' && (!auth.recovery || !auth.user);
  return (
    <section className="mx-auto grid min-h-[75vh] max-w-6xl items-center gap-10 px-6 py-14 lg:grid-cols-2">
      <div className="hidden lg:block">
        <Brand />
        <h1 className="mt-8 text-5xl font-semibold leading-tight tracking-tight">
          A little less scrolling.
          <br />
          <span className="text-primary">A little more living.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-muted-foreground">
          Build a space for your wellbeing, with preferences that fit your
          everyday life.
        </p>
      </div>
      <Card className="w-full max-w-lg justify-self-center">
        <CardContent className="p-7 sm:p-10">
          <h2 className="text-2xl font-semibold">{titles[mode]}</h2>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Sign in to your ScreenWise account.'
              : mode === 'signup'
                ? 'Start with a secure account.'
                : 'We will help you get back to your account.'}
          </p>
          {!authConfigured && (
            <p
              role="alert"
              className="mb-5 rounded-lg bg-secondary p-4 text-sm"
            >
              Authentication is not configured. Add the Supabase environment
              variables to enable account access.
            </p>
          )}
          {invalidRecovery ? (
            <div role="alert">
              <p>This recovery link is invalid or expired.</p>
              <Link
                to="/forgot-password"
                className="mt-4 inline-block text-primary underline"
              >
                Request a new reset link
              </Link>
            </div>
          ) : notice ? (
            <div role="status" className="space-y-5">
              <p>{notice}</p>
              <Link to="/login" className="text-primary underline">
                Return to login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              {mode === 'signup' && (
                <label className="block text-sm font-medium">
                  Full name
                  <Input
                    className="mt-2"
                    autoComplete="name"
                    {...register('fullName')}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={
                      errors.fullName ? 'auth-fullName-error' : undefined
                    }
                  />
                  <FieldError
                    id="auth-fullName-error"
                    message={errors.fullName?.message}
                    className="text-xs text-destructive"
                  />
                </label>
              )}
              {mode !== 'reset-password' && (
                <label className="block text-sm font-medium">
                  Email
                  <Input
                    className="mt-2"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    aria-invalid={!!errors.email}
                    aria-describedby={
                      errors.email ? 'auth-email-error' : undefined
                    }
                  />
                  <FieldError
                    id="auth-email-error"
                    message={errors.email?.message}
                    className="text-xs text-destructive"
                  />
                </label>
              )}
              {mode !== 'forgot-password' && (
                <>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      className="pr-12"
                      type={visible ? 'text' : 'password'}
                      autoComplete={
                        mode === 'login' ? 'current-password' : 'new-password'
                      }
                      {...register('password')}
                      aria-invalid={!!errors.password}
                      aria-describedby={
                        errors.password ? 'auth-password-error' : undefined
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  {mode !== 'login' && (
                    <p className="text-xs text-muted-foreground">
                      12+ characters with uppercase, lowercase, a number, and a
                      symbol.
                    </p>
                  )}
                  <FieldError
                    id="auth-password-error"
                    message={errors.password?.message}
                    className="text-xs text-destructive"
                  />
                </>
              )}
              {(mode === 'signup' || mode === 'reset-password') && (
                <label className="block text-sm font-medium">
                  Confirm password
                  <Input
                    className="mt-2"
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={
                      errors.confirmPassword
                        ? 'auth-confirmPassword-error'
                        : undefined
                    }
                  />
                  <FieldError
                    id="auth-confirmPassword-error"
                    message={errors.confirmPassword?.message}
                    className="text-xs text-destructive"
                  />
                </label>
              )}
              {failure && (
                <p role="alert" className="text-sm text-destructive">
                  {failure}
                </p>
              )}
              <Button
                className="w-full"
                type="submit"
                disabled={!authConfigured || isSubmitting}
              >
                {isSubmitting
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign in'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'forgot-password'
                        ? 'Send reset link'
                        : 'Update password'}
              </Button>
            </form>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-primary">
            {mode === 'login' ? (
              <>
                <Link to="/forgot-password">Forgot password?</Link>
                <Link to="/signup">Create an account</Link>
              </>
            ) : (
              <Link to="/login">Back to sign in</Link>
            )}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Your session survives page refreshes in this tab. Closing the tab
            ends local session storage. Passwords are never stored in your
            browser.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
