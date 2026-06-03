import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { Card, CardHeader, CardTitle, CardContent } from '../card';
import { Badge } from '../badge';
import { Textarea } from '../textarea';

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

  it('renders Badge variants', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'] as const;
    render(
      <div>
        {variants.map((v) => (
          <Badge key={v} variant={v}>
            {v}
          </Badge>
        ))}
      </div>,
    );
    for (const v of variants) {
      expect(screen.getByText(v)).toBeInTheDocument();
    }
  });

  it('renders Textarea', () => {
    render(<Textarea placeholder="notes" />);
    expect(screen.getByPlaceholderText(/notes/i)).toBeInTheDocument();
  });
});
