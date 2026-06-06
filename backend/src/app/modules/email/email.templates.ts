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
  }
};
