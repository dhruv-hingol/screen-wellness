import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { Link } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  reminderInputSchema,
  reminderTypes,
  timezoneSchema,
  type Reminder,
  type ReminderInput,
} from '@screenwise/shared';
import {
  useWellnessQuery,
  useWellnessMutation,
} from '@/features/prevention/hooks/use-wellness';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
import { userApi } from '@/features/profile/services/user-api';
import {
  useUserPreferences,
  useUpdatePreferences,
} from '@/features/profile/hooks/user-hooks';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function ReminderSettingsPage() {
  const query = useWellnessQuery(['reminders'], wellnessApi.reminders);
  const prefs = useUserPreferences();
  const [editing, setEditing] = useState<Reminder | null | undefined>(
    undefined,
  );
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.permission,
  );
  const enabled = !!prefs.data?.notifications_enabled;
  const toggle = useWellnessMutation(
    (value: boolean) =>
      userApi.updatePreferences({ notifications_enabled: value }),
    false,
  );
  const remove = useWellnessMutation(
    (id: string) => wellnessApi.deleteReminder(id),
    false,
  );
  return (
    <>
      <PageHeader
        title="Your reminder preferences"
        description="Gentle prompts while ScreenWise is open. You choose when and how often."
        action={
          <Button
            onClick={() => setEditing(null)}
            disabled={(query.data?.length ?? 0) >= 5}
          >
            Add reminder
          </Button>
        }
      />
      <Card className="mb-6">
        <CardContent className="space-y-5 p-6">
          {prefs.isError ? (
            <QueryError
              error={prefs.error}
              retry={() => void prefs.refetch()}
            />
          ) : (
            prefs.data && (
              <WellnessTimezone
                key={prefs.data.timezone ?? 'default'}
                timezone={prefs.data.timezone ?? 'Asia/Kolkata'}
              />
            )
          )}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              disabled={prefs.isPending || prefs.isError || toggle.isPending}
              checked={enabled}
              onChange={async (e) => {
                try {
                  await toggle.mutateAsync(e.target.checked);
                  await prefs.refetch();
                  toast.success('Notification preference saved');
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            />
            Enable in-app and browser reminder delivery
          </label>
          <p className="text-sm text-muted-foreground">
            Browser permission: {permission}. Delivery is only attempted while a
            tab is visible and active; closing the browser stops reminders. No
            background push service is configured.
          </p>
          <Button
            variant="outline"
            disabled={
              permission === 'unsupported' ||
              permission === 'denied' ||
              permission === 'granted'
            }
            onClick={async () => {
              try {
                setPermission(await Notification.requestPermission());
              } catch {
                toast.error(
                  'Your browser could not request notification permission.',
                );
              }
            }}
          >
            Enable browser notifications
          </Button>
          {permission === 'denied' && (
            <p className="text-sm text-muted-foreground">
              Notifications are blocked. You can change this site’s permission
              in browser settings. In-app messages remain available.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            An enabled schedule also requires the global delivery preference
            above. Paused or disabled reminders generate nothing. Existing
            notification history remains.
          </p>
          <Link to="/settings" className="text-sm text-primary underline">
            Profile and appearance settings
          </Link>
        </CardContent>
      </Card>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit reminder' : 'Add reminder'}
            </DialogTitle>
            <DialogDescription>
              Choose active hours on the same day. No catch-up messages are sent
              for missed intervals.
            </DialogDescription>
          </DialogHeader>
          <ReminderForm
            key={editing?.id ?? 'new'}
            reminder={editing ?? undefined}
            existingTypes={
              query.data
                ?.filter((r) => r.id !== editing?.id)
                .map((r) => r.reminder_type) ?? []
            }
            done={() => setEditing(undefined)}
          />
        </DialogContent>
      </Dialog>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {!query.data.length && (
            <EmptyState
              title="No reminder schedules yet"
              description="Add a reminder, choose its active hours, and enable delivery when you are ready."
            />
          )}
          {query.data.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-4 p-6">
                <h2 className="text-lg font-semibold">
                  {r.reminder_type.replaceAll('_', ' ')}
                </h2>
                <p className="text-sm">
                  {r.enabled ? 'Enabled' : 'Disabled'} ·{' '}
                  {r.reminder_type !== 'EVENING_ROUTINE' && r.interval_minutes
                    ? 'Every ' + r.interval_minutes + ' minutes'
                    : 'Once per active day'}{' '}
                  · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.timezone} · Days:{' '}
                  {r.days_of_week
                    .map(
                      (d) =>
                        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d],
                    )
                    .join(', ')}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={async () => {
                      if (!window.confirm('Remove this reminder schedule?'))
                        return;
                      try {
                        await remove.mutateAsync(r.id);
                        toast.success('Reminder removed');
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
function WellnessTimezone({ timezone }: { timezone: string }) {
  const [value, setValue] = useState(timezone);
  const [error, setError] = useState('');
  const save = useUpdatePreferences();
  return (
    <form
      className="space-y-3 border-b pb-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = timezoneSchema.safeParse(value);
        if (!result.success) {
          setError(
            result.error.issues[0]?.message ?? 'Choose a valid timezone',
          );
          return;
        }
        setError('');
        try {
          await save.mutateAsync({ timezone: result.data });
          toast.success('Wellness timezone saved');
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      <label className="block space-y-2 text-sm">
        Daily checklist timezone
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="wellness-timezone-help"
        />
      </label>
      <p id="wellness-timezone-help" className="text-xs text-muted-foreground">
        Use an IANA timezone such as Asia/Kolkata. Daily checklists reset at
        midnight in this timezone. Goals and reminders keep their own saved
        timezone.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={save.isPending || value === timezone}
        type="submit"
      >
        {save.isPending ? 'Saving...' : 'Save timezone'}
      </Button>
    </form>
  );
}
function ReminderForm({
  reminder,
  existingTypes,
  done,
}: {
  reminder?: Reminder;
  existingTypes: Reminder['reminder_type'][];
  done: () => void;
}) {
  const form = useForm<ReminderInput>({
    resolver: zodResolver(reminderInputSchema),
    defaultValues: reminder
      ? {
          reminder_type: reminder.reminder_type,
          interval_minutes: reminder.interval_minutes,
          enabled: reminder.enabled,
          start_time: reminder.start_time.slice(0, 5),
          end_time: reminder.end_time.slice(0, 5),
          days_of_week: reminder.days_of_week,
          timezone: reminder.timezone,
        }
      : {
          reminder_type:
            reminderTypes.find((t) => !existingTypes.includes(t)) ??
            'EYE_BREAK',
          interval_minutes: 20,
          enabled: true,
          start_time: '09:00',
          end_time: '18:00',
          days_of_week: [1, 2, 3, 4, 5],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
  });
  const days = useWatch({ control: form.control, name: 'days_of_week' });
  const save = useWellnessMutation(
    (body: ReminderInput) => wellnessApi.saveReminder(body, reminder?.id),
    false,
  );
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={form.handleSubmit(async (body) => {
        try {
          await save.mutateAsync(body);
          toast.success('Reminder saved');
          done();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      <label className="block space-y-2 text-sm">
        Reminder type
        <select
          className="block h-10 w-full rounded-md border bg-background px-3"
          {...form.register('reminder_type')}
        >
          {reminderTypes
            .filter((t) => !existingTypes.includes(t))
            .map((t) => (
              <option key={t}>{t}</option>
            ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        Interval minutes (5–240; optional for evening routine)
        <Input
          type="number"
          min="5"
          max="240"
          {...form.register('interval_minutes', {
            setValueAs: (v) => (v === '' ? null : Number(v)),
          })}
        />
        <FieldError
          message={form.formState.errors.interval_minutes?.message}
          className="text-destructive"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        {(['start_time', 'end_time'] as const).map((name) => (
          <label key={name} className="space-y-2 text-sm">
            {name === 'start_time' ? 'Start time' : 'End time'}
            <Input type="time" {...form.register(name)} />
            <FieldError
              message={form.formState.errors[name]?.message}
              className="text-destructive"
            />
          </label>
        ))}
      </div>
      <label className="block space-y-2 text-sm">
        Timezone
        <Input {...form.register('timezone')} />
        <FieldError
          message={form.formState.errors.timezone?.message}
          className="text-destructive"
        />
      </label>
      <fieldset>
        <legend className="mb-3 text-sm">Days of week</legend>
        <div className="flex flex-wrap gap-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, d) => (
            <label key={label} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={days.includes(d)}
                onChange={(e) =>
                  form.setValue(
                    'days_of_week',
                    e.target.checked
                      ? [...days, d]
                      : days.filter((v) => v !== d),
                    { shouldValidate: true },
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
        <FieldError
          message={form.formState.errors.days_of_week?.message}
          className="text-sm text-destructive"
        />
      </fieldset>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" {...form.register('enabled')} />
        Enable schedule
      </label>
      <FormErrors errors={form.formState.errors} />
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving...' : 'Save reminder'}
      </Button>
    </form>
  );
}
