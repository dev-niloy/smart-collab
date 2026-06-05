import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { CommandPalette } from '../CommandPalette';
import type { Project } from '@/lib/schemas/project';
import type { Task } from '@/lib/schemas/task';

const useProjectsMock = vi.fn();
const useTasksMock = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: (p: unknown) => useProjectsMock(p),
}));

vi.mock('@/hooks/useTasks', () => ({
  useTasks: (p: unknown) => useTasksMock(p),
}));

// cmdk is hard to render in jsdom (uses browser-only refs/observers). Mock the
// shadcn Command surface to a transparent set of components so we can assert on
// the wiring without rendering the real cmdk store.
vi.mock('@/components/ui/command', () => {
  return {
    Command: ({ children }: { children: React.ReactNode }) => <div data-testid="palette-command">{children}</div>,
    CommandDialog: ({
      open,
      children,
    }: {
      open: boolean;
      onOpenChange: (o: boolean) => void;
      children: React.ReactNode;
    }) => (open ? <div data-testid="palette-dialog">{children}</div> : null),
    CommandInput: ({
      value,
      onValueChange,
      placeholder,
      ...rest
    }: {
      value: string;
      onValueChange: (v: string) => void;
      placeholder?: string;
    } & Record<string, unknown>) => (
      <input
        {...rest}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
      />
    ),
    CommandList: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
    CommandEmpty: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
    CommandGroup: ({ heading, children }: { heading?: string; children: React.ReactNode }) => (
      <li>
        {heading && <strong>{heading}</strong>}
        <ul>{children}</ul>
      </li>
    ),
    CommandItem: ({
      children,
      onSelect,
    }: {
      value?: string;
      onSelect?: () => void;
      children: React.ReactNode;
    }) => (
      <li>
        <button type="button" onClick={onSelect}>
          {children}
        </button>
      </li>
    ),
    CommandSeparator: () => <li role="separator" />,
  };
});

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Onboarding revamp',
  description: null,
  deadline: new Date().toISOString(),
  status: 'active',
  createdBy: 'u1',
  creator: { id: 'u1', email: 'pm@demo.local', name: 'PM' },
  progress: { done: 0, total: 0, percent: 0 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'Wire up auth',
  description: null,
  status: 'todo',
  priority: 'high',
  dueDate: new Date().toISOString(),
  assignedTo: null,
  createdBy: 'u1',
  creator: { id: 'u1', email: 'pm@demo.local', name: 'PM', role: 'project_manager' },
  assignee: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

function Wrapper({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" data-testid="open-palette" onClick={() => setOpen(true)}>
        open
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    push.mockClear();
    useProjectsMock.mockReset();
    useTasksMock.mockReset();
    useProjectsMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 8 }, isLoading: false });
    useTasksMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 8 }, isLoading: false });
  });

  it('Cmd+K toggles the palette open and Escape closes it', async () => {
    render(<Wrapper />);

    expect(screen.queryByTestId('palette-input')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('palette-input')).toBeInTheDocument());
  });

  it('does not fetch while query is empty', () => {
    render(<Wrapper initialOpen />);

    // hasQuery=false → both hooks called with undefined
    expect(useProjectsMock).toHaveBeenLastCalledWith(undefined);
    expect(useTasksMock).toHaveBeenLastCalledWith(undefined);
  });

  it('debounces typing before firing the search query', async () => {
    render(<Wrapper initialOpen />);

    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'on' } });

    // Before debounce timer fires (200ms), hooks still see undefined.
    expect(useProjectsMock).toHaveBeenLastCalledWith(undefined);

    await waitFor(
      () => {
        expect(useProjectsMock).toHaveBeenLastCalledWith({ q: 'on', limit: 8 });
        expect(useTasksMock).toHaveBeenLastCalledWith({ q: 'on', limit: 8 });
      },
      { timeout: 1000 },
    );
  });

  it('renders Projects + Tasks groups when both have results, capped at 8 each', async () => {
    useProjectsMock.mockReturnValue({
      data: { data: Array.from({ length: 10 }, (_, i) => project({ id: `p${i}`, name: `Proj ${i}` })), total: 10, page: 1, limit: 8 },
      isLoading: false,
    });
    useTasksMock.mockReturnValue({
      data: { data: [task({ id: 'tA', title: 'Wire up auth' })], total: 1, page: 1, limit: 8 },
      isLoading: false,
    });

    render(<Wrapper initialOpen />);
    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'wire' } });

    await waitFor(
      () => {
        expect(screen.getByText('Wire up auth')).toBeInTheDocument();
        expect(screen.getByText('Proj 0')).toBeInTheDocument();
        expect(screen.getByText('Proj 7')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(screen.queryByText('Proj 8')).not.toBeInTheDocument(); // capped
  });

  it('selecting a project routes to /projects/:id and closes', async () => {
    useProjectsMock.mockReturnValue({
      data: { data: [project({ id: 'p42', name: 'Pick me' })], total: 1, page: 1, limit: 8 },
      isLoading: false,
    });
    useTasksMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 8 }, isLoading: false });

    render(<Wrapper initialOpen />);
    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'pick' } });

    const item = await screen.findByText('Pick me', undefined, { timeout: 1000 });
    fireEvent.click(item);

    expect(push).toHaveBeenCalledWith('/projects/p42');
  });

  it('selecting a task routes to /projects/:projectId/tasks/:id', async () => {
    useProjectsMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 8 }, isLoading: false });
    useTasksMock.mockReturnValue({
      data: { data: [task({ id: 'tX', projectId: 'pY', title: 'Ship it' })], total: 1, page: 1, limit: 8 },
      isLoading: false,
    });

    render(<Wrapper initialOpen />);
    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'ship' } });

    const item = await screen.findByText('Ship it', undefined, { timeout: 1000 });
    fireEvent.click(item);

    expect(push).toHaveBeenCalledWith('/projects/pY/tasks/tX');
  });

  it('shows empty-state message when query has no matches', async () => {
    useProjectsMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 8 }, isLoading: false });
    useTasksMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 8 }, isLoading: false });

    render(<Wrapper initialOpen />);
    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'zzz' } });

    await waitFor(
      () => expect(screen.getByText(/no matches for "zzz"/i)).toBeInTheDocument(),
      { timeout: 1000 },
    );
  });
});
