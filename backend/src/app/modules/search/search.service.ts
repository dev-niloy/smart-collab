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

// Rank: primary-field prefix > primary contains > secondary (description)
// contains > nothing. Falling back to description score keeps body-only
// matches from being silently dropped when the limit slice is tight.
const rank = (primary: string, secondary: string | null, needle: string): number => {
  const n = needle.toLowerCase();
  const p = primary.toLowerCase();
  if (p.startsWith(n)) return 0;
  const pIdx = p.indexOf(n);
  if (pIdx !== -1) return pIdx + 1;
  if (secondary) {
    const sIdx = secondary.toLowerCase().indexOf(n);
    if (sIdx !== -1) return 1000 + sIdx;
  }
  return Number.POSITIVE_INFINITY;
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
      _score: rank(p.name, p.description, q),
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
      _score: rank(t.title, t.description, q),
    }))
    .sort((a, b) => a._score - b._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest);

  return { projects: projectHits, tasks: taskHits };
};
