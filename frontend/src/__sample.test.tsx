import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}

describe('frontend toolchain smoke', () => {
  it('runs vitest with jsdom', () => {
    expect(1 + 1).toBe(2);
  });

  it('renders a React component with @testing-library/react', () => {
    render(<Hello name="World" />);
    expect(screen.getByRole('heading', { name: /hello, world/i })).toBeInTheDocument();
  });
});
