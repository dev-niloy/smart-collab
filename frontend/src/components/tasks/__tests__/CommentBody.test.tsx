import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentBody } from '../CommentBody';

const UUID_A = '11111111-2222-4333-8444-555555555555';
const UUID_B = '66666666-7777-4888-9999-aaaaaaaaaaaa';

describe('CommentBody', () => {
  it('renders plain text when no mention token is present', () => {
    render(<CommentBody body="Just a regular comment, nothing special." />);
    expect(screen.getByText(/Just a regular comment/)).toBeInTheDocument();
    expect(screen.queryByTestId('comment-mention-chip')).not.toBeInTheDocument();
  });

  it('chips a single mention with the parsed name + userId data attribute', () => {
    render(<CommentBody body={`Hey @[Demo Member](${UUID_A}) please confirm.`} />);
    const chip = screen.getByTestId('comment-mention-chip');
    expect(chip).toHaveAttribute('data-user-id', UUID_A);
    expect(chip).toHaveTextContent('@Demo Member');
  });

  it('chips multiple distinct mentions in source order', () => {
    render(
      <CommentBody body={`@[A](${UUID_A}) ping @[B](${UUID_B}) — what do you both think?`} />,
    );
    const chips = screen.getAllByTestId('comment-mention-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAttribute('data-user-id', UUID_A);
    expect(chips[1]).toHaveAttribute('data-user-id', UUID_B);
  });

  it('preserves surrounding text + whitespace around chips', () => {
    const { container } = render(<CommentBody body={`Pre @[X](${UUID_A}) post`} />);
    const p = container.querySelector('p');
    expect(p?.textContent).toBe('Pre @X post');
  });

  it('does NOT chip a malformed token (truncated UUID falls through as plain text)', () => {
    const truncated = UUID_A.slice(0, 30);
    render(<CommentBody body={`@[X](${truncated})`} />);
    expect(screen.queryByTestId('comment-mention-chip')).not.toBeInTheDocument();
  });

  it('renders empty body without crashing', () => {
    const { container } = render(<CommentBody body="" />);
    expect(container.querySelector('p')).toBeInTheDocument();
  });
});
