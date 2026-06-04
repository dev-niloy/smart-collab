'use client';

import Link from 'next/link';
import type { ActivityDTO } from '@/lib/schemas/activity';
import { renderVerb, relTime, entityLink } from './verbRegistry';

type Props = {
  item: ActivityDTO;
  now?: Date; // injection point for tests
};

export const ActivityItem = ({ item, now }: Props) => {
  const actor = item.actorName ?? 'Unknown';
  const verb = renderVerb(item);
  const href = entityLink(item);
  const time = relTime(item.createdAt, now);

  const verbNode = href ? (
    <Link href={href} className="underline-offset-2 hover:underline">
      {verb}
    </Link>
  ) : (
    <span>{verb}</span>
  );

  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{actor}</span>{' '}
        <span className="text-muted-foreground">{verbNode}</span>
      </div>
      <time
        className="shrink-0 text-xs text-muted-foreground tabular-nums"
        dateTime={item.createdAt}
      >
        {time}
      </time>
    </li>
  );
};

export default ActivityItem;
