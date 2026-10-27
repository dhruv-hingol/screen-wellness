import { Link } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Eye,
  HeartPulse,
  Moon,
  Leaf,
  ClipboardList,
  BookOpen,
  Target,
  Check,
  Monitor,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
const features = [
  {
    icon: ClipboardList,
    title: 'Understand your habits',
    text: 'Reflect on screen use, sleep, and everyday wellbeing with guided assessments.',
    tag: 'Assessments',
  },
  {
    icon: HeartPulse,
    title: 'Find your balance',
    text: 'Explore a wellness plan with practical activities that fit around your day.',
    tag: 'Personalized wellness',
  },
  {
    icon: BookOpen,
    title: 'Build your knowledge',
    text: 'Make space for learning with a focused library of digital wellness resources.',
    tag: 'Health library',
  },
  {
    icon: Target,
    title: 'Grow at your own pace',
    text: 'Set meaningful goals and follow your progress, one small step at a time.',
    tag: 'Goals & progress',
  },
];
export function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-secondary/50 via-background to-accent/20" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Badge
              variant="secondary"
              className="mb-7 gap-2 rounded-full px-3 py-1.5"
            >
              <span className="size-2 rounded-full bg-teal-500" /> A little less
              scrolling. A little more living.
            </Badge>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.1] tracking-[-.045em] sm:text-6xl lg:text-7xl">
              Your digital life.
              <br />
              <span className="text-primary">A healthier</span>
              <br />
              <span className="text-primary">balance.</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Make room for what matters. ScreenWise helps students and
              professionals understand their screen habits and take small steps
              toward everyday wellbeing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6">
                <Link to="/signup">
                  Get started <ArrowUpRight />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full px-6"
              >
                <a href="#how-it-works">
                  See how it works <ArrowRight />
                </a>
              </Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Your account. Your preferences. Your pace.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="hero-grid relative flex min-h-[470px] items-center justify-center rounded-[2.5rem] border border-white/60 bg-card/40 p-6"
          >
            <div className="absolute size-72 rounded-full bg-secondary/80 blur-3xl" />
            <div className="relative w-full max-w-sm rotate-[-3deg] rounded-3xl border bg-card p-7 shadow-xl shadow-primary/10">
              <div className="mb-8 flex items-center justify-between">
                <span className="rounded-xl bg-secondary p-3 text-primary">
                  <Leaf />
                </span>
                <Badge variant="outline">The ScreenWise approach</Badge>
              </div>
              <p className="text-sm text-muted-foreground">A mindful moment</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Reconnect with
                <br />
                your offline life.
              </h2>
              <div className="relative my-7 flex h-36 items-center justify-center">
                <div className="absolute size-36 rounded-full border border-primary/15" />
                <div className="absolute size-28 rounded-full border border-primary/25" />
                <div className="flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20">
                  <Sun size={36} />
                </div>
                <span className="absolute right-5 top-1 rounded-xl border bg-card p-2 text-teal-600">
                  <Leaf size={20} />
                </span>
                <span className="absolute bottom-1 left-7 rounded-xl border bg-card p-2 text-primary">
                  <Moon size={20} />
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted p-4">
                <span className="rounded-full bg-accent p-1 text-teal-700">
                  <Check size={15} />
                </span>
                <p className="text-sm font-medium">
                  Small steps. Lasting habits.
                </p>
              </div>
            </div>
            <div className="absolute bottom-8 right-3 flex rotate-3 items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-lg sm:right-0">
              <span className="rounded-xl bg-accent p-2 text-teal-700">
                <HeartPulse />
              </span>
              <div>
                <p className="text-sm font-semibold">You come first.</p>
                <p className="text-xs text-muted-foreground">
                  Wellness, beyond the screen.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-7">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">
            Designed around your wellbeing
          </p>
          {[
            [Eye, 'Mindful screen time'],
            [Moon, 'Restful routines'],
            [HeartPulse, 'Everyday movement'],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Eye;
            return (
              <div
                key={String(label)}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <I size={18} className="text-primary" />
                {String(label)}
              </div>
            );
          })}
        </div>
      </section>
      <section
        id="features"
        className="mx-auto max-w-7xl scroll-mt-8 px-6 py-20"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-primary">
              Wellness with intention
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              A little support.
              <br />A healthier everyday.
            </h2>
          </div>
          <p className="max-w-sm leading-relaxed text-muted-foreground">
            One place to understand, improve, and nurture your relationship with
            technology.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text, tag }) => (
            <article
              key={title}
              className="rounded-2xl border bg-card p-6 shadow-sm"
            >
              <div className="mb-8 w-fit rounded-xl bg-secondary/70 p-3 text-primary">
                <Icon />
              </div>
              <p className="mb-2 text-xs font-medium text-primary">{tag}</p>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {text}
              </p>
              <p className="mt-5 text-xs text-muted-foreground">
                Planned for Phase 3+
              </p>
            </article>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-primary">
              Your path to balance
            </p>
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Better habits start with awareness.
            </h2>
            <p className="mt-4 text-muted-foreground">
              The experience we’re building, one thoughtful step at a time.
            </p>
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            {[
              [
                '01',
                'Pause & reflect',
                'Get to know your digital habits through a guided wellness assessment.',
              ],
              [
                '02',
                'Make it personal',
                'Discover a plan designed around your goals and everyday routine.',
              ],
              [
                '03',
                'Keep growing',
                'Build small habits, celebrate progress, and find what works for you.',
              ],
            ].map(([n, title, text]) => (
              <div key={n} className="text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">
                  {n}
                </span>
                <h3 className="mb-3 mt-5 text-xl font-semibold">{title}</h3>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-[#24244f] px-7 py-14 text-center text-white">
          <Sparkles className="mx-auto mb-5 text-[#A78BFA]" size={28} />
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Make space for a more balanced you.
          </h2>
          <p className="mx-auto mb-7 mt-4 max-w-xl leading-relaxed text-indigo-100">
            Take a look around the ScreenWise foundation. Your journey to
            digital wellbeing will grow from here.
          </p>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-white text-[#24244f] hover:bg-indigo-100"
          >
            <Link to="/signup">
              Create your account <Monitor />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
