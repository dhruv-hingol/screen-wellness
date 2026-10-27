import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { Menu, ArrowUpRight } from 'lucide-react';
import { Brand, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
export function PublicLayout() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="border-b bg-card/90">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6"
        >
          <Brand />
          <div className="hidden items-center gap-8 text-sm md:flex">
            <a href="/#features">The platform</a>
            <a href="/#how-it-works">How it works</a>
            <Link to="/login">Log in</Link>
            <Button asChild>
              <Link to="/signup">
                Get started <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>ScreenWise</SheetTitle>
                </SheetHeader>
                <nav
                  className="flex flex-col gap-6 p-6"
                  aria-label="Mobile navigation"
                >
                  <a href="/#features" onClick={() => setOpen(false)}>
                    The platform
                  </a>
                  <a href="/#how-it-works" onClick={() => setOpen(false)}>
                    How it works
                  </a>
                  <Link to="/login" onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                  <Link to="/signup" onClick={() => setOpen(false)}>
                    Get started
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-10">
          <div>
            <Brand />
            <p className="mt-3 text-sm text-muted-foreground">
              A healthier relationship with your digital world.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>GTU project · Phase 2</p>
            <Link
              to="/admin"
              className="mt-2 inline-block underline underline-offset-4"
            >
              Administration
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
