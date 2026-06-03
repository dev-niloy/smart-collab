import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { Card, CardHeader, CardTitle, CardContent } from '../card';

describe('shadcn ui smoke', () => {
  it('renders a Button', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders Input + Label tied via htmlFor/id', () => {
    render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" placeholder="you@example.com" />
      </div>,
    );
    const label = screen.getByText(/email/i);
    const input = screen.getByPlaceholderText(/you@example.com/i);
    expect(label).toBeInTheDocument();
    expect(input).toBeInTheDocument();
  });

  it('renders a Card with title + content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>World</CardContent>
      </Card>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });
});
