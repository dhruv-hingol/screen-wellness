import { fieldLabel } from '@screenwise/shared';
import { cn } from '@/lib/utils';
export function FieldError({
  message,
  id,
  className,
}: {
  message?: string;
  id?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <span
      id={id}
      role="alert"
      className={cn(
        className,
        'block text-sm font-normal leading-relaxed text-destructive [overflow-wrap:anywhere]',
      )}
    >
      {message}
    </span>
  );
}
function collectErrors(
  errors: unknown,
  path: string[] = [],
): { path: string; message: string }[] {
  if (!errors || typeof errors !== 'object') return [];
  if ('message' in errors && typeof errors.message === 'string')
    return [{ path: path.join('.'), message: errors.message }];
  return Object.entries(errors)
    .filter(([key]) => !['ref', 'type', 'types', 'message'].includes(key))
    .flatMap(([key, value]) => collectErrors(value, [...path, key]));
}
export function FormErrors({ errors }: { errors: unknown }) {
  const issues = collectErrors(errors);
  if (!issues.length) return null;
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive [overflow-wrap:anywhere]"
    >
      <p className="font-medium">Please review the following fields:</p>
      <ul className="list-inside list-disc space-y-1">
        {issues.map(({ path, message }) => (
          <li key={path}>
            <button
              type="button"
              className="text-left underline-offset-2 hover:underline"
              onClick={(event) => {
                const form = event.currentTarget.closest('form') ?? document;
                const field = form.querySelector<HTMLElement>(
                  '[name="' + CSS.escape(path) + '"]',
                );
                field?.focus();
                field?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
              }}
            >
              {fieldLabel(path)}: {message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
