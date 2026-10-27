import { useState } from 'react';
import { format } from 'date-fns';
import {
  useWellnessQuery,
  useWellnessMutation,
} from '@/features/prevention/hooks/use-wellness';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const query = useWellnessQuery(
    ['notifications', page, unread],
    () =>
      wellnessApi.notifications({ page, unread: unread ? 'true' : undefined }),
    30000,
  );
  const read = useWellnessMutation((id: string) => wellnessApi.read(id), false);
  const all = useWellnessMutation(() => wellnessApi.readAll(), false);
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Your reminders and saved in-app messages."
        action={
          <Button
            variant="outline"
            disabled={all.isPending}
            onClick={async () => {
              try {
                await all.mutateAsync();
                toast.success('Notifications marked as read');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            Mark all as read
          </Button>
        }
      />
      <label className="mb-6 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => {
            setUnread(e.target.checked);
            setPage(1);
          }}
        />
        Unread only
      </label>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="space-y-4">
            {query.data.data.map((n) => (
              <Card key={n.id}>
                <CardContent className="space-y-3 p-5">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(n.created_at), 'PPp')} ·{' '}
                    {n.type.replaceAll('_', ' ')}
                  </p>
                  <h2
                    className={n.is_read ? 'text-lg' : 'text-lg font-semibold'}
                  >
                    {n.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  {!n.is_read && (
                    <Button
                      variant="outline"
                      disabled={read.isPending}
                      onClick={async () => {
                        try {
                          await read.mutateAsync(n.id);
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                    >
                      Mark as read
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="You're all caught up"
          description="Enabled reminders appear while ScreenWise is open and active."
        />
      )}
    </>
  );
}
