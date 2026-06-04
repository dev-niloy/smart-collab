import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityItem } from '../ActivityItem';
import { renderVerb } from '../verbRegistry';
import type { ActivityDTO } from '@/lib/schemas/activity';

const base: ActivityDTO = {
  id: 'a-1',
  action: 'task.created',
  actorId: 'u-1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 't-1',
  projectId: 'p-1',
  meta: { title: 'Hello' },
  createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
};

describe('ActivityItem', () => {
  it('renders actor name', () => {
    render(<ActivityItem item={base} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('falls back to "Unknown" when actorName is null', () => {
    render(<ActivityItem item={{ ...base, actorName: null }} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders verb from registry for task.created', () => {
    expect(renderVerb(base)).toContain('created task');
  });

  it('falls back to raw action when unknown', () => {
    const unknown = { ...base, action: 'mystery.event' };
    expect(renderVerb(unknown)).toBe('mystery.event');
  });

  it('renders a relative time hint (e.g. 2m ago)', () => {
    render(<ActivityItem item={base} />);
    expect(screen.getByText(/(just now|\d+m ago)/)).toBeInTheDocument();
  });

  it('links to the project page when entity is a project', () => {
    const projItem: ActivityDTO = {
      ...base,
      action: 'project.created',
      entityType: 'project',
      entityId: 'p-1',
      meta: { name: 'My Proj' },
    };
    render(<ActivityItem item={projItem} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/projects/p-1');
  });
});
