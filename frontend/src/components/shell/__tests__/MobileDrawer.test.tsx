import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileDrawer } from '../MobileDrawer';

// shadcn Sheet wraps base-ui Dialog; portals + animations are fragile in jsdom.
// Mock the surface to plain components so we can verify the wiring.
vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    children: React.ReactNode;
  }) => {
    return (
      <div data-testid="sheet" data-open={open ? 'true' : 'false'}>
        {/* Capture click on the rendered trigger by listening at this wrapper level */}
        <div onClickCapture={() => onOpenChange(!open)}>{children}</div>
      </div>
    );
  };
  const SheetTrigger = ({
    render: el,
    children,
  }: {
    render: React.ReactElement;
    children?: React.ReactNode;
  }) => {
    // Clone the render element and inject the children as its children.
    const props = (el.props ?? {}) as Record<string, unknown>;
    const Tag = el.type as React.ElementType;
    return <Tag {...props}>{children}</Tag>;
  };
  const SheetContent = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="sheet-content" className={className}>
      {children}
    </div>
  );
  const SheetHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SheetTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const SheetDescription = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
  return { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription };
});

describe('MobileDrawer', () => {
  it('renders a hamburger trigger button with an accessible label', () => {
    render(
      <MobileDrawer>
        <div data-testid="rail-content">RAIL</div>
      </MobileDrawer>,
    );
    const trigger = screen.getByTestId('mobile-drawer-trigger');
    expect(trigger).toHaveAttribute('aria-label', 'Open navigation');
  });

  it('renders the trigger inside the Sheet (sheet starts closed)', () => {
    render(
      <MobileDrawer>
        <div data-testid="rail-content">RAIL</div>
      </MobileDrawer>,
    );
    const sheet = screen.getByTestId('sheet');
    expect(sheet).toHaveAttribute('data-open', 'false');
  });

  it('flips the sheet to open when the trigger is clicked', () => {
    render(
      <MobileDrawer triggerLabel="Open menu">
        <div data-testid="rail-content">RAIL</div>
      </MobileDrawer>,
    );

    const trigger = screen.getByTestId('mobile-drawer-trigger');
    fireEvent.click(trigger);

    expect(screen.getByTestId('sheet')).toHaveAttribute('data-open', 'true');
  });

  it('renders drawer children (rail + panel) inside SheetContent', () => {
    render(
      <MobileDrawer>
        <div data-testid="rail-content">RAIL</div>
        <div data-testid="panel-content">PANEL</div>
      </MobileDrawer>,
    );

    expect(screen.getByTestId('mobile-drawer-content')).toBeInTheDocument();
    expect(screen.getByTestId('rail-content')).toBeInTheDocument();
    expect(screen.getByTestId('panel-content')).toBeInTheDocument();
  });
});
