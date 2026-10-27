import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import type { UserProfile } from '@screenwise/shared';
import { supabase, requireSupabase } from '@/lib/supabase';
import { userApi } from '@/features/profile/services/user-api';
import { useUIStore } from '@/stores/ui-store';
import { useTimerStore } from '@/features/prevention/stores/timer-store';
import { errorMessage } from '@/lib/errors';
interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  finishRecovery: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  const active = useRef<string | null>(null);
  const refreshProfile = useCallback(async () => {
    if (!active.current) return;
    const id = active.current;
    try {
      const next = await userApi.profile();
      if (active.current === id) {
        setProfile(next);
        setError(null);
      }
    } catch (e) {
      if (active.current === id) setError(errorMessage(e));
      throw e;
    }
  }, []);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    let revision = 0;
    const apply = async (next: Session | null) => {
      const run = ++revision;
      const changed = active.current !== (next?.user.id ?? null);
      if (changed) {
        if (useTimerStore.getState().ownerId !== (next?.user.id ?? null))
          useTimerStore.getState().clear();
        await cache.cancelQueries();
        cache.clear();
        setProfile(null);
        setRecovery(false);
        useUIStore.getState().setTheme('system');
      }
      if (!alive || run !== revision) return;
      active.current = next?.user.id ?? null;
      setSession(next);
      setError(null);
      if (!next) {
        setLoading(false);
        return;
      }
      setLoading(changed);
      try {
        const [p, prefs] = await Promise.all([
          userApi.profile(),
          userApi.preferences(),
        ]);
        if (alive && run === revision) {
          setProfile(p);
          useUIStore.getState().setTheme(prefs.theme);
        }
      } catch (e) {
        if (alive && run === revision) setError(errorMessage(e));
      } finally {
        if (alive && run === revision) setLoading(false);
      }
    };
    // Defer SDK work outside its synchronous auth callback to avoid auth-lock deadlocks.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setTimeout(() => {
        if (!alive) return;
        void apply(next).then(() => {
          if (!alive || active.current !== (next?.user.id ?? null)) return;
          if (event === 'PASSWORD_RECOVERY' && next) {
            sessionStorage.setItem('screenwise-recovery', next.user.id);
            setRecovery(true);
          } else if (
            next &&
            sessionStorage.getItem('screenwise-recovery') === next.user.id
          )
            setRecovery(true);
        });
      }, 0);
    });
    return () => {
      alive = false;
      revision++;
      subscription.unsubscribe();
    };
  }, [cache]);
  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error } = await requireSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };
  const signUp = async (fullName: string, email: string, password: string) => {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (error) throw error;
    return Boolean(data.session);
  };
  const finishRecovery = () => {
    sessionStorage.removeItem('screenwise-recovery');
    setRecovery(false);
  };
  const signOut = async () => {
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
    active.current = null;
    useTimerStore.getState().clear();
    setSession(null);
    setProfile(null);
    finishRecovery();
    await cache.cancelQueries();
    cache.clear();
    useUIStore.getState().setTheme('system');
  };
  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        profile,
        isAuthenticated: Boolean(session),
        isLoading,
        error,
        recovery,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        finishRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
