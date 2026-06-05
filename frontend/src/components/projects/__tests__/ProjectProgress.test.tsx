import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ProjectProgress,
  formatProgressLabel,
  formatProgressLabelLong,
} from '../ProjectProgress';

describe('formatProgressLabel', () => {
  it('returns "0 tasks" when total is 0', () => {
    expect(formatProgressLabel({ done: 0, total: 0, percent: 0 })).toBe('0 tasks');
  });
  it('formats short card label', () => {
    expect(formatProgressLabel({ done: 1, total: 3, percent: 33 })).toBe('1/3 · 33%');
  });
  it('formats long detail label', () => {
    expect(formatProgressLabelLong({ done: 2, total: 3, percent: 67 })).toBe(
      '2 of 3 tasks · 67%',
    );
  });
});

describe('ProjectProgress', () => {
  it('card variant renders bar + short label', () => {
    const { container } = render(
      <ProjectProgress progress={{ done: 1, total: 3, percent: 33 }} variant="card" />,
    );
    expect(container.querySelector('[data-variant="card"]')).toBeTruthy();
    expect(screen.getByText('1/3 · 33%')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: /project progress 33 percent/i });
    expect(bar).toHaveAttribute('aria-valuenow', '33');
  });

  it('card variant for empty project shows "0 tasks"', () => {
    render(<ProjectProgress progress={{ done: 0, total: 0, percent: 0 }} variant="card" />);
    expect(screen.getByText('0 tasks')).toBeInTheDocument();
  });

  it('detail variant renders bar + long label', () => {
    const { container } = render(
      <ProjectProgress progress={{ done: 2, total: 3, percent: 67 }} variant="detail" />,
    );
    expect(container.querySelector('[data-variant="detail"]')).toBeTruthy();
    expect(screen.getByText('2 of 3 tasks · 67%')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /project progress 67 percent/i }),
    ).toBeInTheDocument();
  });

  it('inline variant renders bar with no visible label', () => {
    const { container } = render(
      <ProjectProgress progress={{ done: 1, total: 4, percent: 25 }} variant="inline" />,
    );
    expect(container.querySelector('[data-variant="inline"]')).toBeTruthy();
    expect(screen.queryByText(/1\/4/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /project progress 25 percent/i }),
    ).toBeInTheDocument();
  });

  it('inline variant returns null when total is 0', () => {
    const { container } = render(
      <ProjectProgress progress={{ done: 0, total: 0, percent: 0 }} variant="inline" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
