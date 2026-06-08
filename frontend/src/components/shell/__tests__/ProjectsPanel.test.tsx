import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Project } from '@/lib/schemas/project';

const useProjectsMock = vi.fn();

vi.mock('@/hooks/useProjects', () => ({
  useProjects: (params: unknown) => useProjectsMock(params),
}));

vi.mock('@/hooks/useUser', () => ({
  useRole: () => ({ role: 'admin', isLoading: false }),
}));

// Dialog mount pulls a QueryClient + zod resolver chain that's not relevant
// to the panel surface under test. Stub it to a no-op.
vi.mock('@/components/projects/NewProjectDialog', () => ({
  NewProjectDialog: () => null,
}));

import { ProjectsPanel, PINNED_STORAGE_KEY } from '../ProjectsPanel';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Onboarding revamp',
  description: null,
  deadline: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'active',
  createdBy: 'u1',
  creator: { id: 'u1', email: 'pm@demo.local', name: 'PM' },
  progress: { done: 0, total: 0, percent: 0 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

describe('ProjectsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectsMock.mockReset();
    useProjectsMock.mockReturnValue({
      data: {
        data: [
          project({ id: 'p1', name: 'Onboarding revamp', status: 'active' }),
          project({ id: 'p2', name: 'Q3 polish', status: 'on_hold' }),
          project({ id: 'p3', name: 'Bug bash', status: 'completed' }),
        ],
        total: 3,
        page: 1,
        limit: 50,
      },
      isLoading: false,
    });
  });

  it('renders header, +New CTA, 4 filter chips, and Pinned/All sections', () => {
    render(<ProjectsPanel />);

    expect(screen.getByRole('heading', { level: 2, name: /^projects$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.textContent)).toEqual(['All', 'Active', 'Mine', 'Completed']);

    expect(screen.getByRole('region', { name: /pinned projects/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /all projects/i })).toBeInTheDocument();
  });

  it('shows empty Pinned placeholder when localStorage has no pinned ids', () => {
    render(<ProjectsPanel />);
    expect(screen.getByText(/no pinned projects yet/i)).toBeInTheDocument();
  });

  it('moves projects out of All and into Pinned when their ids are in localStorage', () => {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(['p2']));
    render(<ProjectsPanel />);

    const pinned = screen.getByRole('region', { name: /pinned projects/i });
    const all = screen.getByRole('region', { name: /all projects/i });

    expect(pinned).toHaveTextContent('Q3 polish');
    expect(all).not.toHaveTextContent('Q3 polish');
    expect(all).toHaveTextContent('Onboarding revamp');
  });

  it('renders inline progress bar under pinned rows when total > 0', () => {
    useProjectsMock.mockReturnValue({
      data: {
        data: [
          project({ id: 'p1', name: 'Empty', progress: { done: 0, total: 0, percent: 0 } }),
          project({ id: 'p2', name: 'Partial', progress: { done: 1, total: 3, percent: 33 } }),
        ],
        total: 2,
        page: 1,
        limit: 50,
      },
      isLoading: false,
    });
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(['p1', 'p2']));
    render(<ProjectsPanel />);

    const bars = screen.getAllByRole('progressbar');
    // p1 has total=0 → ProjectProgress returns null. Only p2 renders.
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '33');
  });

  it('does not render inline progress for non-pinned rows', () => {
    useProjectsMock.mockReturnValue({
      data: {
        data: [project({ id: 'p1', name: 'A', progress: { done: 1, total: 2, percent: 50 } })],
        total: 1,
        page: 1,
        limit: 50,
      },
      isLoading: false,
    });
    render(<ProjectsPanel />);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('clicking Active chip re-queries useProjects with status=active', () => {
    render(<ProjectsPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /active/i }));
    expect(useProjectsMock).toHaveBeenLastCalledWith({ status: 'active', limit: 50 });
  });

  it('clicking Mine chip re-queries useProjects with createdBy=me', () => {
    render(<ProjectsPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /mine/i }));
    expect(useProjectsMock).toHaveBeenLastCalledWith({ createdBy: 'me', limit: 50 });
  });

  it('All chip is selected by default and Completed chip switches selection', () => {
    render(<ProjectsPanel />);

    expect(screen.getByRole('tab', { name: /^all$/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /^completed$/i }));
    expect(screen.getByRole('tab', { name: /^all$/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /^completed$/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores garbage values in localStorage pinned key', () => {
    window.localStorage.setItem(PINNED_STORAGE_KEY, 'not-json');
    render(<ProjectsPanel />);
    expect(screen.getByText(/no pinned projects yet/i)).toBeInTheDocument();
  });
});
