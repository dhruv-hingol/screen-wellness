import axios from 'axios';
import { ZodError } from 'zod';
import {
  validationIssueMessage,
  type ValidationIssueLike,
} from '@screenwise/shared';
const authMessages: Record<string, string> = {
  invalid_credentials:
    'The email or password is incorrect. Check both and try again.',
  email_not_confirmed:
    'Confirm your email address using the link in your inbox, then sign in.',
  user_already_exists:
    'An account already exists for this email. Sign in or reset your password.',
  weak_password:
    'Choose a stronger password with at least 12 characters, uppercase and lowercase letters, a number and a symbol.',
  same_password:
    'Choose a new password that is different from your current password.',
  otp_expired:
    'This link has expired or has already been used. Request a new link and open it in the same browser tab.',
  session_not_found: 'Your session has ended. Sign in again to continue.',
  refresh_token_not_found: 'Your session has ended. Sign in again to continue.',
  refresh_token_already_used:
    'Your session needs to be refreshed. Sign in again to continue.',
  over_request_rate_limit:
    'Too many attempts. Wait a moment before trying again.',
  over_email_send_rate_limit:
    'Please wait before requesting another email. Check your inbox and spam folder.',
  email_address_invalid: 'Enter a valid email address.',
  signup_disabled: 'Registration is currently unavailable. Try again later.',
};
function detailsMessage(details: unknown) {
  if (!Array.isArray(details)) return undefined;
  const messages = details
    .filter(
      (value): value is ValidationIssueLike =>
        !!value &&
        typeof value === 'object' &&
        ('message' in value || 'code' in value),
    )
    .map(validationIssueMessage);
  return [...new Set(messages)].slice(0, 3).join(' ') || undefined;
}
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError)
    return (
      detailsMessage(error.issues) ??
      'Check the highlighted fields and try again.'
    );
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return 'This is taking longer than expected. Check your connection and try again.';
    const failure = error.response?.data?.error;
    if (failure?.code === 'VALIDATION_ERROR')
      return (
        detailsMessage(failure.details) ??
        'Check the highlighted fields and try again.'
      );
    if (typeof failure?.message === 'string' && failure.message.trim())
      return failure.message;
    if (!error.response)
      return 'Unable to connect to ScreenWise. Check your internet connection and try again.';
    if (error.response.status === 401)
      return 'Your session has ended. Sign in again to continue.';
    if (error.response.status === 403)
      return 'Your account does not have permission to perform this action.';
    if (error.response.status === 429)
      return 'Too many requests. Wait a moment and try again.';
    return 'ScreenWise could not complete this request. Please try again.';
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    authMessages[error.code]
  )
    return authMessages[error.code]!;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (
    /failed to fetch|networkerror|network request failed|load failed/i.test(
      message,
    )
  )
    return 'Unable to connect to ScreenWise. Check your internet connection and try again.';
  if (message.trim()) return message;
  return 'Something went wrong. Please try again.';
}
