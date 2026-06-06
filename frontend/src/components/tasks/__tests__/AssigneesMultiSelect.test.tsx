import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssigneesMultiSelect, type AssigneeOption } from '../AssigneesMultiSelect';

const opts: AssigneeOption[] = [
  { id: '1', name: 'Alice Anderson', email: 'alice@x.co' },
  { id: '2', name: 'Bob Brown', email: 'bob@x.co' },
  { id: '3', name: 'Carol Chen', email: 'carol@y.co' },
];

describe('AssigneesMultiSelect', () => {
  it('trigger shows placeholder when nothing selected', () => {
    render(
      <AssigneesMultiSelect options={opts} value={[]} onChange={() => {}} placeholder="Pick me" />,
    );
    expect(screen.getByRole('button', { name: /assignees/i })).toHaveTextContent('Pick me');
  });

  it('trigger shows single name when one selected', () => {
    render(<AssigneesMultiSelect options={opts} value={['1']} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /assignees/i })).toHaveTextContent('Alice Anderson');
  });

  it('trigger shows "N selected" when multiple selected', () => {
    render(<AssigneesMultiSelect options={opts} value={['1', '2']} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /assignees/i })).toHaveTextContent('2 selected');
  });

  it('opening the popover renders all options + search input', async () => {
    const user = userEvent.setup();
    render(<AssigneesMultiSelect options={opts} value={[]} onChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    expect(await screen.findByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Alice Anderson')).toBeInTheDocument();
    expect(screen.getByLabelText('Bob Brown')).toBeInTheDocument();
    expect(screen.getByLabelText('Carol Chen')).toBeInTheDocument();
  });

  it('searching by name filters list (cmdk fuzzy match)', async () => {
    const user = userEvent.setup();
    render(<AssigneesMultiSelect options={opts} value={[]} onChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    const search = await screen.findByPlaceholderText(/search by name or email/i);
    await user.type(search, 'alice');
    await waitFor(() => expect(screen.getByLabelText('Alice Anderson')).toBeInTheDocument());
    expect(screen.queryByLabelText('Bob Brown')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Carol Chen')).not.toBeInTheDocument();
  });

  it('searching by email also matches', async () => {
    const user = userEvent.setup();
    render(<AssigneesMultiSelect options={opts} value={[]} onChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    const search = await screen.findByPlaceholderText(/search by name or email/i);
    await user.type(search, 'carol@y');
    await waitFor(() => expect(screen.getByLabelText('Carol Chen')).toBeInTheDocument());
    expect(screen.queryByLabelText('Alice Anderson')).not.toBeInTheDocument();
  });

  it('selecting a row calls onChange with added id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AssigneesMultiSelect options={opts} value={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    await user.click(await screen.findByLabelText('Bob Brown'));
    expect(onChange).toHaveBeenCalledWith(['2']);
  });

  it('deselecting a row removes its id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AssigneesMultiSelect options={opts} value={['1', '2']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    await user.click(await screen.findByLabelText('Alice Anderson'));
    expect(onChange).toHaveBeenCalledWith(['2']);
  });

  it('chip X-button removes the user', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AssigneesMultiSelect options={opts} value={['1']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    const removeBtn = await screen.findByRole('button', { name: /remove alice anderson/i });
    await user.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('empty results state shows custom message', async () => {
    const user = userEvent.setup();
    render(
      <AssigneesMultiSelect
        options={opts}
        value={[]}
        onChange={() => {}}
        emptyMessage="Nobody here."
      />,
    );
    await user.click(screen.getByRole('button', { name: /assignees/i }));
    const search = await screen.findByPlaceholderText(/search by name or email/i);
    await user.type(search, 'nobodymatchesthis');
    expect(await screen.findByText('Nobody here.')).toBeInTheDocument();
  });
});
