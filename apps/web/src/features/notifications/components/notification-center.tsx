import { Link } from 'react-router';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useWellnessQuery,
  useWellnessMutation,
} from '@/features/prevention/hooks/use-wellness';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function NotificationBell() {
  const count = useWellnessQuery(['unread'], wellnessApi.unread, 30000);
  const list = useWellnessQuery(
    ['notification-preview'],
    () => wellnessApi.notifications({ pageSize: 5 }),
    30000,
  );
  const read = useWellnessMutation((id: string) => wellnessApi.read(id), false);
  const readAll = useWellnessMutation(() => wellnessApi.readAll(), false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={'Notifications, ' + (count.data?.count ?? 0) + ' unread'}
        >
          <Bell />
          {!!count.data?.count && (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {count.data.count > 99 ? '99+' : count.data.count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {list.isPending ? (
          <DropdownMenuLabel className="text-sm font-normal">
            Loading...
          </DropdownMenuLabel>
        ) : list.isError ? (
          <DropdownMenuItem onSelect={() => void list.refetch()}>
            Unable to load. Retry
          </DropdownMenuItem>
        ) : !list.data.data.length ? (
          <DropdownMenuLabel className="text-sm font-normal">
            No notifications yet.
          </DropdownMenuLabel>
        ) : (
          list.data.data.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="block whitespace-normal py-3"
              onSelect={async () => {
                if (!n.is_read)
                  try {
                    await read.mutateAsync(n.id);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
              }}
            >
              <p className={n.is_read ? 'font-normal' : 'font-semibold'}>
                {n.title}
                {!n.is_read ? ' · Unread' : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), {
                  addSuffix: true,
                })}
              </p>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={readAll.isPending || !count.data?.count}
          onSelect={async () => {
            try {
              await readAll.mutateAsync();
              toast.success('Notifications marked as read');
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Mark all as read
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/notifications">View notification history</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
