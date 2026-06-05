import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShellLayout } from '../ShellLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadCount: () => ({ data: { count: 0 } }),
}));

const useMediaQueryMock = vi.fn(() => false);
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => useMediaQueryMock(),
  MOBILE_MEDIA_QUERY: '(max-width: 767px)',
}));

vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({ open, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) => (
    <div data-testid="sheet" data-open={open ? 'true' : 'false'}>{children}</div>
  );
  const SheetTrigger = ({ render: el, children }: { render: React.ReactElement; children?: React.ReactNode }) => {
    const Tag = el.type as React.ElementType;
    return <Tag {...(el.props ?? {})}>{children}</Tag>;
  };
  const SheetContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-content" className={className}>{children}</div>
  );
  const SheetHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SheetTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const SheetDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
  return { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription };
});

describe('ShellLayout', () => {
  it('renders rail, panel, topbar, and main slots', () => {
    render(
      <ShellLayout
        railBottom={<div data-testid="rail-bottom-slot">RAIL-BOTTOM</div>}
        panel={<div data-testid="panel-slot">PANEL</div>}
      >
        <div data-testid="children-slot">CONTENT</div>
      </ShellLayout>,
    );

    expect(screen.getByTestId('shell-layout')).toBeInTheDocument();
    expect(screen.getByTestId('shell-rail')).toBeInTheDocument();
    expect(screen.getByTestId('shell-panel')).toBeInTheDocument();
    expect(screen.getByTestId('shell-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('shell-main')).toBeInTheDocument();

    expect(screen.getByTestId('rail-bottom-slot')).toHaveTextContent('RAIL-BOTTOM');
    expect(screen.getByTestId('panel-slot')).toHaveTextContent('PANEL');
    expect(screen.getByTestId('children-slot')).toHaveTextContent('CONTENT');
  });

  it('hides panel content when panelCollapsed is true', () => {
    render(
      <ShellLayout panel={<div data-testid="panel-slot">PANEL</div>} panelCollapsed>
        <div>main</div>
      </ShellLayout>,
    );

    const panel = screen.getByTestId('shell-panel');
    expect(panel).toHaveAttribute('data-collapsed', 'true');
    expect(screen.queryByTestId('panel-slot')).not.toBeInTheDocument();
  });

  it('renders rail and panel as <aside> landmarks with accessible names', () => {
    useMediaQueryMock.mockReturnValueOnce(false);
    render(<ShellLayout><div /></ShellLayout>);
    expect(screen.getByRole('complementary', { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /section navigation/i })).toBeInTheDocument();
  });

  it('switches to mobile mode when useMediaQuery returns true', () => {
    useMediaQueryMock.mockReturnValueOnce(true);
    render(
      <ShellLayout
        panel={<div data-testid="panel-slot">PANEL</div>}
        railBottom={<div data-testid="rail-bottom-slot">RAIL-BOTTOM</div>}
      >
        <div data-testid="children-slot">CONTENT</div>
      </ShellLayout>,
    );

    const shell = screen.getByTestId('shell-layout');
    expect(shell).toHaveAttribute('data-mobile', 'true');
    // hamburger drawer trigger visible
    expect(screen.getByTestId('mobile-drawer-trigger')).toBeInTheDocument();
    // children still render in main
    expect(screen.getByTestId('children-slot')).toBeInTheDocument();
  });
});
