import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../KpiCard';

describe('KpiCard', () => {
  it('renders title + value + sub label', () => {
    render(<KpiCard title="Total tasks" value={42} sub="across all projects" />);
    expect(screen.getByText('Total tasks')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('across all projects')).toBeTruthy();
  });

  it('formats large numbers w/ thousands separator', () => {
    render(<KpiCard title="x" value={1234567} />);
    expect(screen.getByText('1,234,567')).toBeTruthy();
  });

  it('renders loading skeleton when loading', () => {
    const { container } = render(<KpiCard title="x" value={undefined} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders error alert on error', () => {
    render(<KpiCard title="x" value={undefined} error />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
