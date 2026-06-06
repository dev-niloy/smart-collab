import { renderEmail } from '../email.templates';
import type { EmailJobData } from '../email.queue';

const baseAdd = (overrides: Partial<EmailJobData> = {}): EmailJobData => ({
  recipientId: 'r1',
  recipientEmail: 'r@x.com',
  recipientName: 'Riley',
  actorName: 'Alex',
  type: 'project.member_added',
  payload: {
    projectId: 'p-1',
    projectName: 'Demo Web',
    projectDescription: 'Marketing website overhaul',
    projectDeadline: '2026-07-15T00:00:00.000Z',
    projectMembers: [
      { name: 'Alex', role: 'pm' },
      { name: 'Riley', role: 'member' },
      { name: 'Sam', role: 'member' },
    ],
  },
  ...overrides,
});

const baseRole = (overrides: Partial<EmailJobData> = {}): EmailJobData => ({
  ...baseAdd({ type: 'project.member_role_changed' }),
  payload: {
    ...baseAdd().payload,
    previousRole: 'member',
    newRole: 'pm',
  },
  ...overrides,
});

describe('renderEmail — project.member_added', () => {
  it('renders subject + greeting + actor line', () => {
    const r = renderEmail(baseAdd());
    expect(r.subject).toBe('Alex added you to project "Demo Web"');
    expect(r.text).toContain('Hi Riley,');
    expect(r.text).toContain('Alex added you to the project "Demo Web"');
    expect(r.html).toContain('<strong>Demo Web</strong>');
  });

  it('includes the full project context: description + deadline + team list', () => {
    const r = renderEmail(baseAdd());
    expect(r.text).toContain('About this project: Marketing website overhaul');
    expect(r.text).toContain('Deadline: 2026-07-15');
    expect(r.text).toContain('Team (3): Alex (pm), Riley (member), Sam (member)');
    expect(r.html).toContain('Marketing website overhaul');
    expect(r.html).toContain('Deadline');
    expect(r.html).toContain('Alex');
    expect(r.html).toContain('Sam');
    // Render-time member count
    expect(r.html).toContain('Team (3)');
  });

  it('falls back to projectMemberCount when the full members list is not supplied', () => {
    const r = renderEmail(
      baseAdd({
        payload: {
          ...baseAdd().payload,
          projectMembers: undefined,
          projectMemberCount: 8,
        },
      }),
    );
    expect(r.text).toContain('Team size: 8');
    expect(r.html).toContain('Team size:</strong> 8');
  });

  it('renders a project link using PUBLIC_APP_URL when available', () => {
    const prev = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    try {
      const r = renderEmail(baseAdd());
      expect(r.text).toContain('https://app.example.com/projects/p-1');
      expect(r.html).toContain('https://app.example.com/projects/p-1');
    } finally {
      process.env.PUBLIC_APP_URL = prev;
    }
  });

  it('falls back to a relative project link when PUBLIC_APP_URL is unset', () => {
    const prev = process.env.PUBLIC_APP_URL;
    delete process.env.PUBLIC_APP_URL;
    try {
      const r = renderEmail(baseAdd());
      expect(r.text).toContain('/projects/p-1');
      expect(r.html).toContain('href="/projects/p-1"');
    } finally {
      if (prev !== undefined) process.env.PUBLIC_APP_URL = prev;
    }
  });

  it('escapes HTML in description + team names', () => {
    const r = renderEmail(
      baseAdd({
        payload: {
          ...baseAdd().payload,
          projectDescription: '<script>alert(1)</script>',
          projectMembers: [{ name: '<b>boom</b>', role: 'member' }],
        },
      }),
    );
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).toContain('&lt;b&gt;boom&lt;/b&gt;');
  });

  it('keeps the unsubscribe hint and uses the actor fallback', () => {
    const r = renderEmail(baseAdd({ actorName: null }));
    expect(r.subject).toContain('Someone');
    expect(r.text.toLowerCase()).toContain('manage your preferences');
    expect(r.html.toLowerCase()).toContain('manage your preferences');
  });
});

describe('renderEmail — project.member_role_changed', () => {
  it('renders a from-to subject + body', () => {
    const r = renderEmail(baseRole());
    expect(r.subject).toBe('Your role on "Demo Web" is now pm');
    expect(r.text).toContain(
      'Alex changed your role on the project "Demo Web" from member to pm.',
    );
    expect(r.html).toContain('<strong>member</strong>');
    expect(r.html).toContain('<strong>pm</strong>');
  });

  it('still ships the full project context block', () => {
    const r = renderEmail(baseRole());
    expect(r.text).toContain('About this project:');
    expect(r.text).toContain('Deadline: 2026-07-15');
    expect(r.text).toContain('Team (3):');
  });

  it('falls back to "member" labels when the role fields are missing', () => {
    const r = renderEmail(
      baseRole({
        payload: { ...baseRole().payload, previousRole: undefined, newRole: undefined },
      }),
    );
    expect(r.subject).toBe('Your role on "Demo Web" is now member');
    expect(r.text).toContain('from member to member');
  });
});
