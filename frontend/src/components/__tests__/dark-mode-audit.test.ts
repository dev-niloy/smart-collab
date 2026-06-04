import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../..');

// Hardcoded light-only color classnames that break theme-toggle behaviour.
// Exception: opacity-suffixed values like bg-black/10 are used as backdrop overlays.
const BANNED = [
  /\bbg-white\b(?!\/)/, // bg-white not bg-white/something
  /\btext-black\b(?!\/)/,
  /\bbg-black\b(?!\/)/, // catches plain bg-black; bg-black/10 backdrop is fine
  /\btext-white\b(?!\/)/,
];

const collect = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...collect(path.join(dir, entry.name)));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
};

describe('dark mode audit', () => {
  it('no source file uses hardcoded light-only color classnames', () => {
    const files = collect(SRC_ROOT);
    const offenders: { file: string; pattern: string; line: number; text: string }[] = [];
    for (const f of files) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const p of BANNED) {
          if (p.test(line)) {
            offenders.push({ file: path.relative(SRC_ROOT, f), pattern: p.source, line: i + 1, text: line.trim().slice(0, 120) });
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('theme tokens (bg-card, bg-background, text-foreground, text-muted-foreground) are widely used', () => {
    const files = collect(SRC_ROOT);
    let hits = 0;
    const tokens = /\bbg-(card|background|popover|muted)\b|\btext-(foreground|muted-foreground|destructive)\b/;
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      const matches = content.match(new RegExp(tokens, 'g'));
      if (matches) hits += matches.length;
    }
    // Threshold is generous — just confirms tokens are the default vocabulary.
    expect(hits).toBeGreaterThan(50);
  });
});
