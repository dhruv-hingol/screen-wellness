import { useState } from 'react';
import { toast } from 'sonner';
import type { ArticleMedia } from '@screenwise/shared';
import { libraryApi } from '@/features/library/services/library-api';
import {
  useLibraryQuery,
  useLibraryMutation,
} from '@/features/library/hooks/use-library';
import {
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/errors';
export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (media: ArticleMedia) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const query = useLibraryQuery(['media', page], () => libraryApi.media(page));
  const upload = useLibraryMutation(libraryApi.upload),
    remove = useLibraryMutation(libraryApi.deleteMedia);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Article media</DialogTitle>
          <DialogDescription>
            Images are publicly accessible by URL, including draft images.
            Upload only media intended for publication. JPEG, PNG, WebP; maximum
            5 MB.
          </DialogDescription>
        </DialogHeader>
        <label className="block space-y-2 text-sm">
          Upload image
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={upload.isPending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error('Choose an image up to 5 MB.');
                return;
              }
              try {
                const media = await upload.mutateAsync(file);
                toast.success('Image uploaded');
                onSelect(media);
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          />
        </label>
        {upload.isPending && (
          <p role="status">Validating and uploading image…</p>
        )}
        {query.isError ? (
          <QueryError error={query.error} retry={() => void query.refetch()} />
        ) : query.isPending ? (
          <p role="status">Loading media…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {query.data.data.map((m) => (
                <div key={m.id} className="space-y-2 rounded-xl border p-3">
                  <img
                    src={m.url}
                    alt="Uploaded article image"
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={m.status !== 'READY'}
                    onClick={() => onSelect(m)}
                  >
                    Use image
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    disabled={remove.isPending || m.status !== 'READY'}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          'Delete this image? Images still used by any article cannot be deleted.',
                        )
                      )
                        return;
                      try {
                        await remove.mutateAsync(m.id);
                        toast.success('Unused image removed');
                      } catch (error) {
                        toast.error(errorMessage(error));
                      }
                    }}
                  >
                    Delete unused image
                  </Button>
                </div>
              ))}
            </div>
            {!query.data.data.length && (
              <p className="text-sm text-muted-foreground">
                No media yet. Upload an image to get started.
              </p>
            )}
            <Pagination
              page={page}
              pages={query.data.meta.totalPages}
              onChange={setPage}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
