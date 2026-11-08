// Content validator. Run: npm run validate
//   node scripts/validate.ts                 — validate everything
//   node scripts/validate.ts --topic <id>    — only that topic (repeatable)
//   node scripts/validate.ts --missing       — print a glossary skeleton of uncovered words
//   node scripts/validate.ts --stats         — print per-topic counts
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTopic, type Issue } from '../src/lib/validation.ts';
import type { Dict } from '../src/lib/lexicon.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const topicsDir = join(root, 'src/content/topics');
const core: Dict = JSON.parse(readFileSync(join(root, 'src/content/core.json'), 'utf8'));

const args = process.argv.slice(2);
const only: string[] = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--topic') only.push(args[++i]);
const showMissing = args.includes('--missing');
const showStats = args.includes('--stats');

const files = readdirSync(topicsDir)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => only.length === 0 || only.includes(f.replace(/\.json$/, '')))
  .sort();

let errors = 0;
let warnings = 0;
const seenIds = new Map<string, string>();
const missingAll: Record<string, Record<string, string>> = {};
const levelCount: Record<string, number> = {};

for (const f of files) {
  const id = f.replace(/\.json$/, '');
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(topicsDir, f), 'utf8'));
  } catch (e) {
    console.log(`✖ ${f}: invalid JSON — ${(e as Error).message}`);
    errors++;
    continue;
  }
  const res = checkTopic(data, id, core, seenIds);
  const errs = res.issues.filter((i: Issue) => i.level === 'error');
  const warns = res.issues.filter((i: Issue) => i.level === 'warn');
  errors += errs.length;
  warnings += warns.length;
  if (res.level) levelCount[res.level] = (levelCount[res.level] ?? 0) + 1;
  const mark = errs.length ? '✖' : warns.length ? '⚠' : '✔';
  const st = res.stats;
  console.log(
    `${mark} ${id}  q=${st.questions} exam=${st.exam} opts[2/3/4]=${st.opts[2]}/${st.opts[3]}/${st.opts[4]} types[gap/pick/same]=${st.types.gap}/${st.types.pick}/${st.types.same} glossary=${st.glossary}`,
  );
  for (const i of [...errs, ...warns]) console.log(`    ${i.level === 'error' ? 'error' : 'warn '}  ${i.where}: ${i.msg}`);
  if (res.missing.length) {
    missingAll[id] = Object.fromEntries(res.missing.map((w) => [w, '']));
  }
  if (showStats && res.unused.length) console.log(`    info   unused glossary: ${res.unused.join(', ')}`);
}

if (showMissing && Object.keys(missingAll).length) {
  console.log('\nMissing glossary words (add to each topic\'s "glossary"):');
  console.log(JSON.stringify(missingAll, null, 2));
}

console.log(
  `\n${files.length} topic file(s): ${Object.entries(levelCount)
    .map(([l, n]) => `${l}=${n}`)
    .join(' ')} · ${errors} error(s), ${warnings} warning(s)`,
);
process.exit(errors ? 1 : 0);
