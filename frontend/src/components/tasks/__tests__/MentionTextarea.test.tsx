import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MentionTextarea } from '../MentionTextarea';

const ALICE_ID = '11111111-2222-4333-8444-555555555555';
const BOB_ID = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const CAROL_ID = 'bbbbbbbb-cccc-4ddd-9eee-ffffffffffff';

const wrap = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
};

const mockAssignable = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/members/assignable')) {
      return new Response(
        JSON.stringify({
          data: [
            { id: ALICE_ID, name: 'Alice', email: 'alice@example.com', role: 'team_member', projectRole: 'member' },
            { id: BOB_ID, name: 'Bob', email: 'bob@example.com', role: 'team_member', projectRole: 'member' },
            { id: CAROL_ID, name: 'Carol', email: 'carol@example.com', role: 'project_manager', projectRole: 'pm' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });

const Harness = ({ projectId = 'p1', initial = '' }: { projectId?: string; initial?: string }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MentionTextarea value={value} onChange={setValue} projectId={projectId} aria-label="composer" />
      <output data-testid="captured-value">{value}</output>
    </>
  );
};

describe('MentionTextarea', () => {
  let qc: QueryClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockAssignable() as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    qc.clear();
  });

  it('typing @ opens the popover with every assignable member', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ta = await screen.findByLabelText('composer');
    await user.click(ta);
    await user.keyboard('@');
    await waitFor(() => expect(screen.getByTestId('mention-popover')).toBeInTheDocument());
    expect(screen.getByTestId(`mention-option-${ALICE_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`mention-option-${BOB_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`mention-option-${CAROL_ID}`)).toBeInTheDocument();
  });

  it('filters the list by name as the user types after @', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ta = await screen.findByLabelText('composer');
    await user.click(ta);
    await user.keyboard('@bo');
    await waitFor(() =>
      expect(screen.getByTestId(`mention-option-${BOB_ID}`)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId(`mention-option-${ALICE_ID}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`mention-option-${CAROL_ID}`)).not.toBeInTheDocument();
  });

  it('Enter inserts @[Name](userId) at the caret and advances past it', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ta = await screen.findByLabelText('composer');
    await user.click(ta);
    await user.keyboard('Hey @');
    await waitFor(() => expect(screen.getByTestId('mention-popover')).toBeInTheDocument());
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('captured-value')).toHaveTextContent(
        `Hey @[Bob](${BOB_ID})`,
      );
    });
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
  });

  it('Escape closes the popover without inserting', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ta = await screen.findByLabelText('composer');
    await user.click(ta);
    await user.keyboard('@');
    await waitFor(() => expect(screen.getByTestId('mention-popover')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
    expect(screen.getByTestId('captured-value')).toHaveTextContent('@');
  });

  it('does NOT open the popover when @ is typed immediately after a letter (e.g. email-like context)', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ta = await screen.findByLabelText('composer');
    await user.click(ta);
    await user.keyboard('user@');
    // No popover — the @ is preceded by a non-whitespace char.
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
  });

  it('clicking a popover option inserts the token (mouseDown path)', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ta = await screen.findByLabelText('composer');
    await user.click(ta);
    await user.keyboard('@al');
    await waitFor(() =>
      expect(screen.getByTestId(`mention-option-${ALICE_ID}`)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId(`mention-option-${ALICE_ID}`));
    await waitFor(() => {
      expect(screen.getByTestId('captured-value')).toHaveTextContent(
        `@[Alice](${ALICE_ID})`,
      );
    });
  });
});
