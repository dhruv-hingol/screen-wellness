import { create } from 'zustand';
import { persist } from 'zustand/middleware';
type Theme = 'light' | 'dark' | 'system';
export const useUIStore = create<{
  theme: Theme;
  collapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}>()(
  persist(
    (set) => ({
      theme: 'system',
      collapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({
          theme:
            s.theme === 'dark' ||
            (s.theme === 'system' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches)
              ? 'light'
              : 'dark',
        })),
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    {
      name: 'screenwise-ui',
      version: 1,
      partialize: (s) => ({ theme: s.theme, collapsed: s.collapsed }),
    },
  ),
);
