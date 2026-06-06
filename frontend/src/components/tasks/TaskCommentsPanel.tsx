'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from '@/hooks/useComments';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import { MAX_COMMENT_BODY } from '@/lib/schemas/comment';
import type { CommentDTO } from '@/lib/schemas/comment';
import type { Role } from '@/lib/schemas/auth';
import { CommentBody } from './CommentBody';
import { MentionTextarea } from './MentionTextarea';

const MAX_BODY = MAX_COMMENT_BODY;

type Props = {
  taskId: string;
  projectId: string;
  projectRole?: 'pm' | 'member' | 'admin' | null;
};

const canEdit = (c: CommentDTO, userId: string | undefined, systemRole: Role | undefined): boolean => {
  if (!userId) return false;
  return c.author.id === userId || systemRole === 'admin';
};

const canDelete = (
  c: CommentDTO,
  userId: string | undefined,
  systemRole: Role | undefined,
  projectRole?: 'pm' | 'member' | 'admin' | null,
): boolean => {
  if (!userId) return false;
  if (c.author.id === userId) return true;
  if (systemRole === 'admin') return true;
  if (projectRole === 'pm' || projectRole === 'admin') return true;
  return false;
};

type RowProps = {
  comment: CommentDTO;
  taskId: string;
  canEditRow: boolean;
  canDeleteRow: boolean;
};

function CommentRow({ comment, taskId, canEditRow, canDeleteRow }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateComment(taskId);
  const del = useDeleteComment(taskId);

  const saveEdit = async () => {
    try {
      await update.mutateAsync({ id: comment.id, body: draft.trim() });
      toast.success('Comment updated');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    }
  };
  const onConfirmDelete = async () => {
    try {
      await del.mutateAsync(comment.id);
      toast.success('Comment deleted');
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <li className="border border-border rounded-md p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{comment.author.name}</span>
        <time className="text-muted-foreground" dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_BODY}
            aria-label="Edit comment"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={!draft.trim() || draft.length > MAX_BODY}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(comment.body); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <CommentBody body={comment.body} />
      )}
      {!editing && (
        <div className="flex gap-2">
          {canEditRow && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {canDeleteRow && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      )}
      {canDeleteRow && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmDelete} disabled={del.isPending}>
                {del.isPending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
}

export function TaskCommentsPanel({ taskId, projectId, projectRole }: Props) {
  const { user } = useUser();
  const q = useComments(taskId);
  const create = useCreateComment(taskId);
  const [body, setBody] = useState('');

  const all = useMemo(
    () => (q.data?.pages ?? []).flatMap((p) => p.items),
    [q.data?.pages],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > MAX_BODY) return;
    try {
      await create.mutateAsync(trimmed);
      setBody('');
      toast.success('Comment posted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Post failed');
    }
  };

  const overLimit = body.length > MAX_BODY;
  const empty = body.trim().length === 0;

  return (
    <section aria-label="Comments" className="space-y-4">
      <h3 className="text-lg font-semibold">Comments</h3>
      <form onSubmit={onSubmit} className="space-y-2">
        <MentionTextarea
          value={body}
          onChange={setBody}
          projectId={projectId}
          placeholder="Add a comment… type @ to mention a teammate"
          aria-label="New comment body"
          maxLength={MAX_BODY + 50}
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {body.length} / {MAX_BODY}
          </span>
          <Button type="submit" disabled={empty || overLimit || create.isPending}>
            {create.isPending ? 'Posting…' : 'Post comment'}
          </Button>
        </div>
      </form>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : all.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {all.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              taskId={taskId}
              canEditRow={canEdit(c, user?.id, user?.role)}
              canDeleteRow={canDelete(c, user?.id, user?.role, projectRole)}
            />
          ))}
        </ul>
      )}

      {q.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
        >
          {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  );
}
