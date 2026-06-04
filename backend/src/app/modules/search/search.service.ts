import { prisma } from '../../../config/prisma';
import { DEFAULT_HIT_LIMIT } from './search.constant';

export type ProjectHit = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: Date;
};

export type TaskHit = {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  projectName: string;
  status: string;
  priority: string;
  dueDate: Date;
};

export type SearchResult = {
  projects: ProjectHit[];
  tasks: TaskHit[];
};

type Args = {
  q: string;
  limit?: number;
};

// Rank prefix-matches above contains-matches so "foo" → "Foo Bar" beats
// "Barfoo". Cheap O(n) two-pass sort that doesn't need a real FTS index.
const prefixThenContainsScore = (haystack: string, needle: string): number => {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.startsWith(n)) return 0;
  const idx = h.indexOf(n);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx + 1;
};

export const search = async (args: Args): Promise<SearchResult> => {
  const limit = args.limit ?? DEFAULT_HIT_LIMIT;
  const q = args.q;
  const contains = { contains: q, mode: 'insensitive' as const };

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ name: contains }, { description: contains }] },
      take: limit * 2,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        deadline: true,
      },
    }),
    prisma.task.findMany({
      where: { OR: [{ title: contains }, { description: contains }] },
      take: limit * 2,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        projectId: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { name: true } },
      },
    }),
  ]);

  const projectHits: ProjectHit[] = projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      deadline: p.deadline,
      _score: prefixThenContainsScore(p.name, q),
    }))
    .sort((a, b) => a._score - b._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest);

  const taskHits: TaskHit[] = tasks
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      projectId: t.projectId,
      projectName: t.project.name,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      _score: prefixThenContainsScore(t.title, q),
    }))
    .sort((a, b) => a._score - b._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest);

  return { projects: projectHits, tasks: taskHits };
};
