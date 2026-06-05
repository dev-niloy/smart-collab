import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShellLayout } from '../ShellLayout';

describe('ShellLayout', () => {
  it('renders rail, panel, topbar, and main slots', () => {
    render(
      <ShellLayout
        rail={<div data-testid="rail-slot">RAIL</div>}
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

    // slot contents render
    expect(screen.getByTestId('rail-slot')).toHaveTextContent('RAIL');
    expect(screen.getByTestId('panel-slot')).toHaveTextContent('PANEL');
    expect(screen.getByTestId('children-slot')).toHaveTextContent('CONTENT');
  });

  it('hides panel content when panelCollapsed is true', () => {
    render(
      <ShellLayout
        panel={<div data-testid="panel-slot">PANEL</div>}
        panelCollapsed
      >
        <div>main</div>
      </ShellLayout>,
    );

    const panel = screen.getByTestId('shell-panel');
    expect(panel).toHaveAttribute('data-collapsed', 'true');
    expect(screen.queryByTestId('panel-slot')).not.toBeInTheDocument();
  });

  it('renders rail and panel as <aside> landmarks with accessible names', () => {
    render(<ShellLayout><div /></ShellLayout>);
    expect(screen.getByRole('complementary', { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /section navigation/i })).toBeInTheDocument();
  });
});
