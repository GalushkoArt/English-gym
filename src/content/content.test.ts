import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTopic } from '../lib/validation.ts';
import type { Dict } from '../lib/lexicon.ts';

const dir = join(__dirname, 'topics');
const core: Dict = JSON.parse(readFileSync(join(__dirname, 'core.json'), 'utf8'));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('content', () => {
  it('has topics for every level', () => {
    const levels = new Set(files.map((f) => f.slice(0, 2)));
    expect([...levels].sort()).toEqual(['b1', 'b2', 'c1']);
  });

  const seen = new Map<string, string>();
  for (const f of files) {
    it(`${f} is valid and fully translatable`, () => {
      const id = f.replace(/\.json$/, '');
      const res = checkTopic(JSON.parse(readFileSync(join(dir, f), 'utf8')), id, core, seen);
      const errors = res.issues.filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.msg}`);
      expect(errors).toEqual([]);
    });
  }
});
