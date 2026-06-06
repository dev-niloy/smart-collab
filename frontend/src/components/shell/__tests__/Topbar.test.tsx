import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Topbar } from '../Topbar';

describe('Topbar', () => {
  it('renders empty topbar with breadcrumbs landmark', () => {
    render(<Topbar />);
    expect(screen.getByTestId('shell-topbar')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /breadcrumbs/i })).toBeInTheDocument();
  });

  it('renders plain string segments with / separators (no separator before the first)', () => {
    render(<Topbar segments={['Projects', 'Q3 polish']} />);

    const nav = screen.getByRole('navigation', { name: /breadcrumbs/i });
    expect(within(nav).getByText('Projects')).toBeInTheDocument();
    expect(within(nav).getByText('Q3 polish')).toBeInTheDocument();
    const separators = within(nav).getAllByText('/');
    expect(separators).toHaveLength(1);
  });

  it('renders intermediate segments with hrefs as Next.js Links', () => {
    render(<Topbar segments={[{ label: 'Projects', href: '/projects' }, 'Q3 polish']} />);

    const link = screen.getByRole('link', { name: /projects/i });
    expect(link).toHaveAttribute('href', '/projects');
  });

  it('does not turn the last segment into a link, even when href is supplied', () => {
    render(
      <Topbar
        segments={[
          { label: 'Projects', href: '/projects' },
          { label: 'Q3 polish', href: '/projects/123' },
        ]}
      />,
    );

    // Only the first intermediate segment is a link; the last stays as text.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/projects');
    expect(screen.getByText('Q3 polish').tagName.toLowerCase()).toBe('span');
  });

  it('renders the actions slot on the right side', () => {
    render(
      <Topbar
        segments={['Dashboard']}
        actions={
          <button type="button" data-testid="action-btn">
            Save
          </button>
        }
      />,
    );

    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });
});
