import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
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

/**
 * jsdom does not implement real text-input on a contentEditable div, so
 * the tests below drive the component by mutating its DOM directly and
 * dispatching the React synthetic events that the component listens to.
 * The fallback `extendSelectionBackward` path in MentionTextarea is the
 * one that runs here; the production `Selection.modify` path is
 * exercised in real browsers via the manual smoke checklist.
 */
const typeAtCaret = (el: HTMLElement, text: string) => {
  el.focus();
  // Append the text as a child text node so the contentEditable layout
  // stays sane, then move the caret to the end.
  el.appendChild(document.createTextNode(text));
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  act(() => {
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
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

  it('renders an existing mention token as a chip in the editor', async () => {
    render(<Harness initial={`Hi @[Alice](${ALICE_ID})`} />, { wrapper: wrap(qc) });
    await waitFor(() => {
      const chip = screen.getByTestId('comment-mention-chip');
      expect(chip).toHaveTextContent('@Alice');
      expect(chip.getAttribute('data-mention-user-id')).toBe(ALICE_ID);
    });
  });

  it('typing @ opens the popover with every assignable member', async () => {
    render(<Harness />, { wrapper: wrap(qc) });
    const ed = await screen.findByLabelText('composer');
    typeAtCaret(ed, '@');
    await waitFor(() => expect(screen.getByTestId('mention-popover')).toBeInTheDocument());
    expect(screen.getByTestId(`mention-option-${ALICE_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`mention-option-${BOB_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`mention-option-${CAROL_ID}`)).toBeInTheDocument();
  });

  it('filters the list by typed query after @', async () => {
    render(<Harness />, { wrapper: wrap(qc) });
    const ed = await screen.findByLabelText('composer');
    typeAtCaret(ed, '@bo');
    await waitFor(() => expect(screen.getByTestId(`mention-option-${BOB_ID}`)).toBeInTheDocument());
    expect(screen.queryByTestId(`mention-option-${ALICE_ID}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`mention-option-${CAROL_ID}`)).not.toBeInTheDocument();
  });

  it('clicking a popover option inserts a chip and emits the wire-format value', async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper: wrap(qc) });
    const ed = await screen.findByLabelText('composer');
    typeAtCaret(ed, '@al');
    await waitFor(() =>
      expect(screen.getByTestId(`mention-option-${ALICE_ID}`)).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId(`mention-option-${ALICE_ID}`));
    await waitFor(() => {
      expect(screen.getByTestId('comment-mention-chip')).toBeInTheDocument();
      expect(screen.getByTestId('captured-value')).toHaveTextContent(`@[Alice](${ALICE_ID})`);
    });
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
  });

  it('does NOT open the popover when @ is typed immediately after a letter', async () => {
    render(<Harness />, { wrapper: wrap(qc) });
    const ed = await screen.findByLabelText('composer');
    typeAtCaret(ed, 'user@');
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
  });

  it('serializes back to the empty string when the editor is empty', async () => {
    render(<Harness />, { wrapper: wrap(qc) });
    expect(screen.getByTestId('captured-value')).toHaveTextContent('');
  });
});
