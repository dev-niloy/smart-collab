// Per-event-type email rendering. Keeps subject / text / html in one file so
// future copy changes don't require touching the processor. Templates are
// intentionally plain — no MJML / handlebars / etc. — because the messages
// are short and adding a template engine would dwarf the win.

import type { EmailJobData } from './email.queue';

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const greeting = (name: string): string => `Hi ${name},`;

const signature = (): string =>
  '\n\n— Smart Collab\nYou received this because you have email notifications turned on. ' +
  'Manage your preferences in your profile.';

const signatureHtml = (): string =>
  '<p style="color:#666;font-size:12px;margin-top:24px">' +
  '— Smart Collab<br>You received this because you have email notifications turned on. ' +
  '<a href="#">Manage your preferences</a> in your profile.' +
  '</p>';

const wrap = (heading: string, bodyHtml: string): string =>
  `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;padding:16px">` +
  `<h2 style="margin:0 0 12px">${escapeHtml(heading)}</h2>` +
  bodyHtml +
  signatureHtml() +
  `</div>`;

export const renderEmail = (data: EmailJobData): RenderedEmail => {
  const actor = data.actorName ?? 'Someone';
  const task = data.payload.taskTitle ?? 'a task';
  const excerpt = data.payload.commentExcerpt ?? '';
  const status = data.payload.status ?? '';

  switch (data.type) {
    case 'comment.mention': {
      const subject = `${actor} mentioned you on "${task}"`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} mentioned you in a comment on the task "${task}":\n\n` +
        `> ${excerpt}` +
        signature();
      const html = wrap(
        `${actor} mentioned you on "${task}"`,
        `<p>${escapeHtml(actor)} mentioned you in a comment on ` +
          `<strong>${escapeHtml(task)}</strong>:</p>` +
          `<blockquote style="border-left:3px solid #ddd;padding:8px 12px;color:#444">` +
          `${escapeHtml(excerpt)}` +
          `</blockquote>`,
      );
      return { subject, text, html };
    }
    case 'comment.created': {
      const subject = `${actor} commented on "${task}"`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} commented on the task "${task}":\n\n` +
        `> ${excerpt}` +
        signature();
      const html = wrap(
        `${actor} commented on "${task}"`,
        `<p>${escapeHtml(actor)} commented on ` +
          `<strong>${escapeHtml(task)}</strong>:</p>` +
          `<blockquote style="border-left:3px solid #ddd;padding:8px 12px;color:#444">` +
          `${escapeHtml(excerpt)}` +
          `</blockquote>`,
      );
      return { subject, text, html };
    }
    case 'task.assigned': {
      const subject = `${actor} assigned you to "${task}"`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} assigned you to the task "${task}".` +
        signature();
      const html = wrap(
        `${actor} assigned you to "${task}"`,
        `<p>${escapeHtml(actor)} assigned you to ` +
          `<strong>${escapeHtml(task)}</strong>.</p>`,
      );
      return { subject, text, html };
    }
    case 'task.unassigned': {
      const subject = `${actor} unassigned you from "${task}"`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} unassigned you from the task "${task}".` +
        signature();
      const html = wrap(
        `${actor} unassigned you from "${task}"`,
        `<p>${escapeHtml(actor)} unassigned you from ` +
          `<strong>${escapeHtml(task)}</strong>.</p>`,
      );
      return { subject, text, html };
    }
    case 'task.status_changed': {
      const subject = `"${task}" is now ${status}`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} changed the status of "${task}" to ${status}.` +
        signature();
      const html = wrap(
        `"${task}" is now ${status}`,
        `<p>${escapeHtml(actor)} changed the status of ` +
          `<strong>${escapeHtml(task)}</strong> to ` +
          `<strong>${escapeHtml(status)}</strong>.</p>`,
      );
      return { subject, text, html };
    }
    case 'project.member_added': {
      const projectName = data.payload.projectName ?? 'a project';
      const ctx = renderProjectContext(data);
      const link = projectLinkOrNull(data.payload.projectId);
      const subject = `${actor} added you to project "${projectName}"`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} added you to the project "${projectName}".\n\n` +
        ctx.text +
        (link ? `\n\nOpen the project: ${link}\n` : '') +
        signature();
      const html = wrap(
        `${actor} added you to "${projectName}"`,
        `<p>${escapeHtml(actor)} added you to the project ` +
          `<strong>${escapeHtml(projectName)}</strong>.</p>` +
          ctx.html +
          (link
            ? `<p style="margin-top:16px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open project</a></p>`
            : ''),
      );
      return { subject, text, html };
    }
    case 'project.member_role_changed': {
      const projectName = data.payload.projectName ?? 'a project';
      const previousRole = data.payload.previousRole ?? 'member';
      const newRole = data.payload.newRole ?? 'member';
      const ctx = renderProjectContext(data);
      const link = projectLinkOrNull(data.payload.projectId);
      const subject = `Your role on "${projectName}" is now ${newRole}`;
      const text =
        `${greeting(data.recipientName)}\n\n` +
        `${actor} changed your role on the project "${projectName}" from ${previousRole} to ${newRole}.\n\n` +
        ctx.text +
        (link ? `\n\nOpen the project: ${link}\n` : '') +
        signature();
      const html = wrap(
        `Your role on "${projectName}" is now ${newRole}`,
        `<p>${escapeHtml(actor)} changed your role on ` +
          `<strong>${escapeHtml(projectName)}</strong> from ` +
          `<strong>${escapeHtml(previousRole)}</strong> to ` +
          `<strong>${escapeHtml(newRole)}</strong>.</p>` +
          ctx.html +
          (link
            ? `<p style="margin-top:16px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open project</a></p>`
            : ''),
      );
      return { subject, text, html };
    }
  }
};

// Shared "full body" project context block used by project.member_* templates.
// Pulls projectDescription, projectDeadline, and the projectMembers team list
// (falling back to projectMemberCount when the producer skipped the full list)
// from the payload and renders both a plain-text and HTML variant.
const renderProjectContext = (
  data: EmailJobData,
): { text: string; html: string } => {
  const lines: string[] = [];
  const htmlBlocks: string[] = [];

  const description = data.payload.projectDescription;
  if (description) {
    lines.push(`About this project: ${description}`);
    htmlBlocks.push(
      `<p><strong>About this project:</strong> ${escapeHtml(description)}</p>`,
    );
  }

  const deadlineRaw = data.payload.projectDeadline;
  if (deadlineRaw) {
    const formatted = formatDeadline(deadlineRaw);
    lines.push(`Deadline: ${formatted}`);
    htmlBlocks.push(
      `<p><strong>Deadline:</strong> ${escapeHtml(formatted)}</p>`,
    );
  }

  const members = data.payload.projectMembers;
  if (members && members.length > 0) {
    const formattedTeam = members
      .map((m) => `${m.name} (${m.role})`)
      .join(', ');
    lines.push(`Team (${members.length}): ${formattedTeam}`);
    htmlBlocks.push(
      `<p><strong>Team (${members.length}):</strong></p>` +
        `<ul style="margin:4px 0 12px 16px;padding:0">` +
        members
          .map(
            (m) =>
              `<li style="margin:2px 0">${escapeHtml(m.name)} ` +
              `<span style="color:#666">(${escapeHtml(m.role)})</span></li>`,
          )
          .join('') +
        `</ul>`,
    );
  } else if (typeof data.payload.projectMemberCount === 'number') {
    lines.push(`Team size: ${data.payload.projectMemberCount}`);
    htmlBlocks.push(
      `<p><strong>Team size:</strong> ${data.payload.projectMemberCount}</p>`,
    );
  }

  return { text: lines.join('\n'), html: htmlBlocks.join('') };
};

const formatDeadline = (raw: string): string => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString().slice(0, 10);
};

// Builds an absolute-style link if PUBLIC_APP_URL is set, otherwise a path
// the assessor can hand-copy. We never embed half-baked URLs from request
// state — the queue payload only carries the projectId.
const projectLinkOrNull = (projectId: string | undefined): string | null => {
  if (!projectId) return null;
  const base = (process.env.PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return base ? `${base}/projects/${projectId}` : `/projects/${projectId}`;
};
