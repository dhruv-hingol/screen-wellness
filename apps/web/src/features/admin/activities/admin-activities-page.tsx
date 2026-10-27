import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  activityInputSchema,
  activityCategories,
  type Activity,
  type ActivityInput,
} from '@screenwise/shared';
import {
  useWellnessQuery,
  useWellnessMutation,
} from '@/features/prevention/hooks/use-wellness';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
import { PageHeader } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function AdminActivitiesPage() {
  const [editing, setEditing] = useState<Activity | null | undefined>(
    undefined,
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useWellnessQuery(['admin-activities', search, page], () =>
    wellnessApi.activities({ search, page }, true),
  );
  const archive = useWellnessMutation((id: string) =>
    wellnessApi.archiveActivity(id),
  );
  return (
    <>
      <PageHeader
        title="Wellness activities"
        description="Manage the shared activity collection. Existing session snapshots remain unchanged."
        action={
          <Button onClick={() => setEditing(null)}>Create activity</Button>
        }
      />
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit activity' : 'Create activity'}
            </DialogTitle>
            <DialogDescription>
              Use clear educational steps and modest wellness language. Avoid
              clinical claims.
            </DialogDescription>
          </DialogHeader>
          <ActivityForm
            key={editing?.id ?? 'new'}
            activity={editing ?? undefined}
            done={() => setEditing(undefined)}
          />
        </DialogContent>
      </Dialog>
      <Input
        className="mb-5 max-w-sm"
        aria-label="Search activities"
        placeholder="Search activities"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{a.category}</TableCell>
                  <TableCell>{a.is_active ? 'Active' : 'Archived'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setEditing(a)}>
                        Edit
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to={'/admin/recommendations?activityId=' + a.id}>
                          Linked rules
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!a.is_active || archive.isPending}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              'Archive this activity? Existing sessions remain.',
                            )
                          )
                            return;
                          try {
                            await archive.mutateAsync(a.id);
                            toast.success('Activity archived');
                          } catch (e) {
                            toast.error(errorMessage(e));
                          }
                        }}
                      >
                        Archive
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
function ActivityForm({
  activity,
  done,
}: {
  activity?: Activity;
  done: () => void;
}) {
  const form = useForm<ActivityInput>({
    resolver: zodResolver(activityInputSchema),
    defaultValues: activity
      ? {
          title: activity.title,
          slug: activity.slug,
          description: activity.description,
          category: activity.category,
          duration_seconds: activity.duration_seconds,
          instructions: activity.instructions,
          benefits: activity.benefits,
          safety_notes: activity.safety_notes,
          icon: activity.icon,
          image_url: activity.image_url,
          difficulty: activity.difficulty,
          is_active: activity.is_active,
        }
      : {
          title: '',
          slug: '',
          description: '',
          category: 'GENERAL',
          duration_seconds: 60,
          instructions: [],
          benefits: [],
          safety_notes:
            'Stop if this causes pain or discomfort. General wellness education only.',
          icon: null,
          image_url: null,
          difficulty: 'EASY',
          is_active: true,
        },
  });
  const save = useWellnessMutation((body: ActivityInput) =>
    wellnessApi.saveActivity(body, activity?.id),
  );
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(async (body) => {
        try {
          await save.mutateAsync(body);
          toast.success('Activity saved');
          done();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      {(['title', 'slug', 'description', 'safety_notes'] as const).map(
        (name) => (
          <label key={name} className="block space-y-2 text-sm">
            {name.replaceAll('_', ' ')}
            {name === 'description' || name === 'safety_notes' ? (
              <Textarea
                {...form.register(name, {
                  setValueAs: (v) => (name === 'safety_notes' ? v || null : v),
                })}
              />
            ) : (
              <Input {...form.register(name)} />
            )}
            <FieldError
              message={form.formState.errors[name]?.message}
              className="text-destructive"
            />
          </label>
        ),
      )}
      <label className="block space-y-2 text-sm">
        Category
        <select
          className="block h-10 w-full rounded-md border bg-background px-3"
          {...form.register('category')}
        >
          {activityCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        Duration seconds
        <Input
          type="number"
          min="5"
          max="7200"
          {...form.register('duration_seconds', { valueAsNumber: true })}
        />
      </label>
      <label className="block space-y-2 text-sm">
        Difficulty
        <select
          className="block h-10 w-full rounded-md border bg-background px-3"
          {...form.register('difficulty')}
        >
          <option>EASY</option>
          <option>MODERATE</option>
        </select>
      </label>
      {(['instructions', 'benefits'] as const).map((name) => (
        <label key={name} className="block space-y-2 text-sm">
          {name === 'instructions'
            ? 'Numbered steps (one per line)'
            : 'Educational benefits (one per line)'}
          <Textarea
            rows={5}
            defaultValue={activity?.[name].join('\n') ?? ''}
            {...form.register(name, {
              setValueAs: (v) =>
                typeof v === 'string'
                  ? v
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                  : v,
            })}
          />
        </label>
      ))}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" {...form.register('is_active')} />
        Published / active
      </label>
      <FormErrors errors={form.formState.errors} />
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving...' : 'Save activity'}
      </Button>
    </form>
  );
}
