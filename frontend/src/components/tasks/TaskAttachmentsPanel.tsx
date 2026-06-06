'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/useAttachments';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import { attachmentDownloadUrl } from '@/lib/attachments';
import { MAX_ATTACHMENT_SIZE } from '@/lib/schemas/attachment';
import type { AttachmentDTO } from '@/lib/schemas/attachment';
import type { Role } from '@/lib/schemas/auth';

const MAX_SIZE = MAX_ATTACHMENT_SIZE;

type Props = {
  taskId: string;
  projectRole?: 'pm' | 'member' | 'admin' | null;
};

const canDelete = (
  a: AttachmentDTO,
  userId: string | undefined,
  systemRole: Role | undefined,
  projectRole?: 'pm' | 'member' | 'admin' | null,
): boolean => {
  if (!userId) return false;
  if (a.uploader.id === userId) return true;
  if (systemRole === 'admin') return true;
  if (projectRole === 'pm' || projectRole === 'admin') return true;
  return false;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type RowProps = {
  attachment: AttachmentDTO;
  taskId: string;
  canDeleteRow: boolean;
};

function AttachmentRow({ attachment, taskId, canDeleteRow }: RowProps) {
  const del = useDeleteAttachment(taskId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const onConfirmDelete = async () => {
    try {
      await del.mutateAsync(attachment.id);
      toast.success('Attachment deleted');
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };
  return (
    <li className="flex items-center justify-between border border-border rounded-md p-3 bg-card text-sm">
      <div className="flex flex-col">
        <a
          href={attachmentDownloadUrl(attachment.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline-offset-2 hover:underline"
        >
          {attachment.filename}
        </a>
        <span className="text-xs text-muted-foreground">
          {formatSize(attachment.sizeBytes)} · {attachment.uploader.name}
        </span>
      </div>
      {canDeleteRow && (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)}>
            Delete
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                <AlertDialogDescription>
                  {attachment.filename} will be removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirmDelete} disabled={del.isPending}>
                  {del.isPending ? 'Deleting…' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </li>
  );
}

export function TaskAttachmentsPanel({ taskId, projectRole }: Props) {
  const { user } = useUser();
  const { data, isLoading } = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [picking, setPicking] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error('File too large (max 10MB)');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setPicking(true);
    try {
      await upload.mutateAsync(file);
      toast.success(`Uploaded ${file.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setPicking(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const items = data?.items ?? [];

  return (
    <section aria-label="Attachments" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Attachments</h3>
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            data-testid="attachment-file-input"
            aria-label="Upload file"
            onChange={onChange}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={picking || upload.isPending}
          >
            {picking || upload.isPending ? 'Uploading…' : 'Upload file'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading attachments…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              taskId={taskId}
              canDeleteRow={canDelete(a, user?.id, user?.role, projectRole)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
