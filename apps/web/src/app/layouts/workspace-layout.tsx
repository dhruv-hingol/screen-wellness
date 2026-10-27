import { NotificationBell } from '@/features/notifications/components/notification-center';
import { WellnessCoordinator } from '@/features/notifications/components/wellness-coordinator';
import { useAuth } from '@/features/auth/auth-provider';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard,
  ClipboardList,
  Sparkles,
  HeartPulse,
  BookOpen,
  FolderOpen,
  Bookmark,
  ChartNoAxesCombined,
  Target,
  Settings,
  Users,
  FileText,
  ListChecks,
  SlidersHorizontal,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  UserRound,
  ArrowUpRight,
} from 'lucide-react';
import { Brand, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
const userNav = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Assessments', '/assessments', ClipboardList],
  ['Wellness Plan', '/wellness-plan', Sparkles],
  ['Prevention', '/prevention', HeartPulse],
  ['Health Library', '/library', BookOpen],
  ['Saved Articles', '/library/bookmarks', Bookmark],
  ['Progress', '/progress', ChartNoAxesCombined],
  ['Goals', '/goals', Target],
  ['Settings', '/settings', Settings],
] as const;
const adminNav = [
  ['Overview', '/admin', LayoutDashboard],
  ['Users', '/admin/users', Users],
  ['Assessments', '/admin/assessments', ClipboardList],
  ['Articles', '/admin/articles', FileText],
  ['Categories & Tags', '/admin/categories', FolderOpen],
  ['Activities', '/admin/activities', ListChecks],
  ['Recommendation Rules', '/admin/recommendations', SlidersHorizontal],
  ['Analytics', '/admin/analytics', ChartNoAxesCombined],
] as const;
export function WorkspaceLayout({ admin = false }: { admin?: boolean }) {
  const { profile, user, signOut } = useAuth();
  const { collapsed, toggleSidebar } = useUIStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const nav = admin ? adminNav : userNav;
  const current =
    nav.find(([, path]) => location.pathname === path)?.[0] ?? 'Detail preview';
  const navigation = (compact = false) => (
    <nav
      aria-label={admin ? 'Admin navigation' : 'Workspace navigation'}
      className="space-y-1.5"
    >
      {nav.map(([label, path, Icon]) => (
        <Tooltip key={path}>
          <TooltipTrigger asChild>
            <NavLink
              to={path}
              end={path === '/admin'}
              onClick={() => setOpen(false)}
              aria-label={label}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary',
                compact && 'justify-center gap-0 px-0',
              )}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {!compact && <span className="min-w-0 leading-5">{label}</span>}
            </NavLink>
          </TooltipTrigger>
          {compact && <TooltipContent side="right">{label}</TooltipContent>}
        </Tooltip>
      ))}
    </nav>
  );
  return (
    <div className="flex min-h-screen">
      <WellnessCoordinator />
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh min-h-0 shrink-0 flex-col overflow-hidden border-r bg-card py-5 md:flex',
          collapsed ? 'w-20 px-3' : 'w-64 px-5',
        )}
      >
        <div
          className={cn(
            'flex h-10 shrink-0 items-center',
            collapsed && 'justify-center',
          )}
        >
          <Brand compact={collapsed} />
        </div>
        <p
          className={cn(
            'mb-4 mt-6 shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground',
            collapsed && 'text-center',
          )}
        >
          {collapsed ? '•••' : admin ? 'Administration' : 'Your workspace'}
        </p>
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1 -mx-1"
          tabIndex={0}
          aria-label={
            admin
              ? 'Scrollable admin navigation'
              : 'Scrollable workspace navigation'
          }
        >
          {navigation(collapsed)}
        </div>
        <div
          className={cn('shrink-0 pt-4', collapsed && 'flex justify-center')}
        >
          {!collapsed && (
            <div className="sidebar-wellness-note mb-3 rounded-xl bg-secondary/50 p-4">
              <p className="text-sm font-semibold">Room to grow.</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Small steps toward a more balanced digital life.
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open workspace navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="h-dvh min-h-0 overflow-hidden"
              >
                <SheetHeader>
                  <SheetTitle>
                    {admin ? 'Administration' : 'Your workspace'}
                  </SheetTitle>
                </SheetHeader>
                <div
                  className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-5"
                  tabIndex={0}
                  aria-label="Scrollable mobile navigation"
                >
                  {navigation()}
                </div>
              </SheetContent>
            </Sheet>
            <nav aria-label="Breadcrumb" className="text-sm">
              <Link to="/" className="text-muted-foreground">
                Home
              </Link>
              <span aria-hidden="true" className="mx-2">
                /
              </span>
              <span aria-current="page">{current}</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label="Account menu"
                  className="group max-w-[min(18rem,60vw)] gap-2"
                >
                  <span className="rounded-full bg-secondary p-2">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="size-5 rounded-full object-cover"
                      />
                    ) : (
                      <UserRound size={16} />
                    )}
                  </span>
                  <span className="hidden min-w-0 truncate sm:inline">
                    {profile?.full_name}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{profile?.full_name}</DropdownMenuLabel>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile?.role === 'ADMIN' && (
                  <DropdownMenuItem asChild>
                    <Link to={admin ? '/dashboard' : '/admin'}>
                      {admin ? 'User dashboard' : 'Administration'}{' '}
                      <ArrowUpRight />
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    void signOut().catch((e) => toast.error(errorMessage(e)))
                  }
                >
                  Sign out
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/">Back to website</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl p-5 py-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
