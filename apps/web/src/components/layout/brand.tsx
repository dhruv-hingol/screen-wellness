import { useAuth } from '@/features/auth/auth-provider';
import { userApi } from '@/features/profile/services/user-api';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { Link } from 'react-router';
import { Activity, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/ui-store';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="ScreenWise home"
      className="inline-flex items-center gap-2.5 font-bold tracking-tight"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
        <Activity size={22} />
      </span>
      {!compact && (
        <span className="text-lg">
          ScreenWise<span className="text-primary">.</span>
        </span>
      )}
    </Link>
  );
}
export function ThemeToggle() {
  const { theme, toggleTheme } = useUIStore();
  const { user } = useAuth();
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        const previous = useUIStore.getState().theme;
        toggleTheme();
        if (user) {
          try {
            await userApi.updatePreferences({
              theme: useUIStore.getState().theme,
            });
          } catch (e) {
            useUIStore.getState().setTheme(previous);
            toast.error(errorMessage(e));
          }
        }
      }}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
