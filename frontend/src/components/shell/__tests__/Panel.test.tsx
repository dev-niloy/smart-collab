import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from '../Panel';

describe('Panel', () => {
  it('renders <aside> with accessible name and children when not collapsed', () => {
    render(
      <Panel>
        <div data-testid="content">PANEL-CONTENT</div>
      </Panel>,
    );

    const aside = screen.getByRole('complementary', { name: /section navigation/i });
    expect(aside).toHaveAttribute('data-collapsed', 'false');
    expect(aside).toHaveClass('w-[260px]');
    expect(screen.getByTestId('content')).toHaveTextContent('PANEL-CONTENT');
  });

  it('hides children and shrinks to width 0 when collapsed', () => {
    render(
      <Panel collapsed>
        <div data-testid="content">SHOULD-NOT-RENDER</div>
      </Panel>,
    );

    const panel = screen.getByTestId('shell-panel');
    expect(panel).toHaveAttribute('data-collapsed', 'true');
    expect(panel).toHaveClass('w-0');
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });
});
