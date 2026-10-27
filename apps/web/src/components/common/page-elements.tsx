import type { ReactNode } from 'react';
import { Sprout, LoaderCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="my-2 text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center px-6 py-16 text-center">
        <div className="mb-5 rounded-2xl bg-secondary p-4 text-primary">
          <Sprout size={30} />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mb-6 mt-3 max-w-lg text-muted-foreground [overflow-wrap:anywhere]">
          {description}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}
export function LoadingState() {
  return (
    <div role="status" className="flex items-center gap-2 p-6">
      <LoaderCircle className="animate-spin" />
      Loading…
    </div>
  );
}
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader
        title={title}
        description="A little more balance is on the way."
        action={<Badge variant="secondary">Coming in Phase 3+</Badge>}
      />
      <EmptyState
        title={`${title}, thoughtfully in progress`}
        description="This route is part of the ScreenWise foundation. This feature will be introduced in a later phase; this feature does not collect data yet."
      />
    </>
  );
}
