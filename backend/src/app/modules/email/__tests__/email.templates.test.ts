import { renderEmail } from '../email.templates';
import type { EmailJobData } from '../email.queue';

const base = (overrides: Partial<EmailJobData> = {}): EmailJobData => ({
  recipientId: 'r1',
  recipientEmail: 'r@x.com',
  recipientName: 'Riley',
  actorName: 'Alex',
  type: 'comment.mention',
  payload: { taskTitle: 'Ship docs', commentExcerpt: 'hey @riley check this' },
  ...overrides,
});

describe('renderEmail', () => {
  it('renders comment.mention with subject, text, and html', () => {
    const r = renderEmail(base());
    expect(r.subject).toBe('Alex mentioned you on "Ship docs"');
    expect(r.text).toContain('Hi Riley,');
    expect(r.text).toContain('Alex mentioned you');
    expect(r.text).toContain('> hey @riley check this');
    expect(r.html).toContain('<strong>Ship docs</strong>');
    expect(r.html).toContain('Manage your preferences');
  });

  it('renders comment.created', () => {
    const r = renderEmail(base({ type: 'comment.created' }));
    expect(r.subject).toBe('Alex commented on "Ship docs"');
    expect(r.text).toContain('Alex commented on');
  });

  it('renders task.assigned', () => {
    const r = renderEmail(base({ type: 'task.assigned' }));
    expect(r.subject).toBe('Alex assigned you to "Ship docs"');
    expect(r.text).toContain('assigned you to');
    expect(r.html).toContain('assigned you to');
  });

  it('renders task.unassigned', () => {
    const r = renderEmail(base({ type: 'task.unassigned' }));
    expect(r.subject).toBe('Alex unassigned you from "Ship docs"');
    expect(r.text).toContain('unassigned you from');
  });

  it('renders task.status_changed with status', () => {
    const r = renderEmail(
      base({ type: 'task.status_changed', payload: { taskTitle: 'Ship docs', status: 'done' } }),
    );
    expect(r.subject).toBe('"Ship docs" is now done');
    expect(r.text).toContain('changed the status of "Ship docs" to done');
  });

  it('falls back to "Someone" when actorName is null', () => {
    const r = renderEmail(base({ actorName: null }));
    expect(r.subject).toContain('Someone');
  });

  it('falls back to "a task" when taskTitle missing', () => {
    const r = renderEmail(base({ payload: {} }));
    expect(r.subject).toContain('"a task"');
  });

  it('escapes HTML in actor / task / excerpt for the html body', () => {
    const r = renderEmail(
      base({
        actorName: '<script>x</script>',
        payload: { taskTitle: '<b>boom</b>', commentExcerpt: '"a" & b' },
      }),
    );
    expect(r.html).not.toContain('<script>x</script>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).toContain('&lt;b&gt;boom&lt;/b&gt;');
    expect(r.html).toContain('&quot;a&quot; &amp; b');
  });

  it('does NOT escape text body — plain text is fine as-is', () => {
    const r = renderEmail(
      base({
        actorName: 'A & B',
      }),
    );
    expect(r.text).toContain('A & B');
  });

  it('includes opt-out hint in every rendered email', () => {
    const types: EmailJobData['type'][] = [
      'comment.mention',
      'comment.created',
      'task.assigned',
      'task.unassigned',
      'task.status_changed',
    ];
    for (const t of types) {
      const r = renderEmail(base({ type: t, payload: { taskTitle: 'T', status: 'done' } }));
      expect(r.text.toLowerCase()).toContain('manage your preferences');
      expect(r.html.toLowerCase()).toContain('manage your preferences');
    }
  });
});
