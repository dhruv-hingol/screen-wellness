import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { useTimerStore } from '@/features/prevention/stores/timer-store';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
import { toast } from 'sonner';
export function WellnessCoordinator() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const current = useTimerStore.getState();
    if (current.ownerId && current.ownerId !== user.id) current.clear();
    const tick = () => {
      const previous = useTimerStore.getState().phase;
      useTimerStore.getState().tick(Date.now());
      if (
        previous === 'FOCUS' &&
        useTimerStore.getState().phase === 'FOCUS_READY'
      ) {
        toast.info('Ready for a visual break?', {
          description:
            'Your focus interval has finished. Start your break when it suits you.',
          action: {
            label: 'Open timer',
            onClick: () => navigate('/prevention'),
          },
        });
      }
    };
    const timer = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user, navigate]);
  useEffect(() => {
    if (!user) return;
    let active = true,
      inFlight = false;
    const poll = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const notifications = await wellnessApi.poll();
        if (!active) return;
        if (notifications.length) {
          await cache.invalidateQueries({ queryKey: ['wellness', user.id] });
          for (const n of notifications) {
            toast.info(n.title, { description: n.message });
            if (
              typeof Notification !== 'undefined' &&
              Notification.permission === 'granted'
            )
              try {
                new Notification(n.title, { body: n.message, tag: n.id });
              } catch {
                /* In-app delivery remains available if the browser blocks system notifications. */
              }
          }
        }
      } catch {
        /* Polling retries on the next interval. Settings and history show actionable API errors. */
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 30000);
    const onVisible = () => void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, cache]);
  return null;
}
