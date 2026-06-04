'use client';

import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ActivityPage } from '@/lib/schemas/activity';
import { ActivityItem } from './ActivityItem';

type Query = UseInfiniteQueryResult<{ pages: ActivityPage[] }, Error>;

type Props = {
  query: Query;
  hideLoadMore?: boolean;
  emptyText?: string;
};

const Skeleton = () => (
  <ul
    className="divide-y"
    data-testid="activity-skeleton"
    role="status"
    aria-label="Loading activity"
  >
    {[0, 1, 2].map((i) => (
      <li key={i} className="py-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </li>
    ))}
  </ul>
);

export const ActivityFeed = ({ query, hideLoadMore, emptyText = 'No activity yet.' }: Props) => {
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;

  if (isPending) return <Skeleton />;

  if (isError) {
    return (
      <div className="space-y-2 text-sm" role="alert">
        <p className="text-destructive">Couldn’t load activity. {error?.message ?? ''}</p>
        <button
          type="button"
          className="text-xs underline-offset-2 hover:underline"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y" aria-label="Activity feed" aria-busy={isFetchingNextPage}>
        {items.map((it) => (
          <ActivityItem key={it.id} item={it} />
        ))}
      </ul>
      {!hideLoadMore && hasNextPage ? (
        <div className="pt-2">
          <button
            type="button"
            className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ActivityFeed;
