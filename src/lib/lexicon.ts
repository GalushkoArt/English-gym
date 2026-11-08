// Tokenising task texts into tappable words and resolving them against
// the topic glossary + core dictionary. Shared by the UI and the validator.

export type Dict = Record<string, string>;

export type Segment =
  | { kind: 'word'; text: string; start: boolean }
  | { kind: 'gap'; index: number }
  | { kind: 'text'; text: string }
  | { kind: 'label'; text: string }
  | { kind: 'br' };

export const GAP_RE = /_{3,}/g;

const LETTER = "A-Za-z\\u00C0-\\u00FF";
const WORD_RE = new RegExp(
  `[${LETTER}0-9]+(?:['’][${LETTER}]+)*(?:-[${LETTER}0-9]+(?:['’][${LETTER}]+)*)*`,
  'g',
);
const SPEAKER_RE = /^([AB]):\s*/;

export function normalizeApostrophes(s: string): string {
  return s.replace(/’/g, "'");
}

export function countGaps(q: string): number {
  return (q.match(GAP_RE) ?? []).length;
}

/** Split an option for a multi-gap question into its parts. */
export function splitOption(option: string, gaps: number): string[] {
  if (gaps <= 1) return [option];
  return option.split(' / ').map((p) => p.trim());
}

/**
 * Split a task text into segments. Lines are separated by "\n";
 * a line may start with a speaker label "A:" / "B:".
 */
export function tokenize(q: string): Segment[] {
  const out: Segment[] = [];
  let gapIndex = 0;
  const lines = q.split('\n');
  lines.forEach((rawLine, li) => {
    if (li > 0) out.push({ kind: 'br' });
    let line = rawLine;
    const sp = SPEAKER_RE.exec(line);
    if (sp) {
      out.push({ kind: 'label', text: sp[1] });
      line = line.slice(sp[0].length);
    }
    // sentence start: beginning of line or after . ! ? (optionally followed by quotes)
    let sentenceStart = true;
    const parts = line.split(/(_{3,})/);
    for (const part of parts) {
      if (/^_{3,}$/.test(part)) {
        out.push({ kind: 'gap', index: gapIndex++ });
        sentenceStart = false;
        continue;
      }
      let last = 0;
      WORD_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WORD_RE.exec(part))) {
        const between = part.slice(last, m.index);
        if (between) {
          out.push({ kind: 'text', text: between });
          if (/[.!?]["')\]]*\s*$/.test(between)) sentenceStart = true;
        }
        const tok = m[0];
        if (/[0-9]/.test(tok)) {
          out.push({ kind: 'text', text: tok });
          sentenceStart = false;
        } else {
          out.push({ kind: 'word', text: tok, start: sentenceStart });
          sentenceStart = false;
        }
        last = m.index + tok.length;
      }
      const tail = part.slice(last);
      if (tail) {
        out.push({ kind: 'text', text: tail });
        if (/[.!?]["')\]]*\s*$/.test(tail)) sentenceStart = true;
      }
    }
  });
  return out;
}

export interface Resolution {
  /** Key that matched in the dictionary. */
  key: string;
  ru: string;
  /** True when the match came from a heuristic (stemming / another topic). */
  approx?: boolean;
}

function exactIn(token: string, start: boolean, dicts: Dict[]): Resolution | null {
  const t = normalizeApostrophes(token);
  const lower = t.toLowerCase();
  const candidates = start ? [lower, t] : [t, lower];
  for (const c of candidates) {
    for (const d of dicts) {
      const v = d[c];
      if (typeof v === 'string') return { key: c, ru: v };
    }
  }
  return null;
}

/**
 * Strict lookup used by the validator: exact surface form (case-aware),
 * or a possessive "'s" stripped. No stemming.
 */
export function resolveStrict(token: string, start: boolean, dicts: Dict[]): Resolution | null {
  const direct = exactIn(token, start, dicts);
  if (direct) return direct;
  const t = normalizeApostrophes(token);
  if (/'s$/i.test(t)) {
    const base = exactIn(t.slice(0, -2), start, dicts);
    if (base) return { key: base.key, ru: base.ru + ' (притяж.)' };
  }
  return null;
}

function stemCandidates(w: string): string[] {
  const c: string[] = [];
  const push = (s: string) => {
    if (s.length > 1 && !c.includes(s)) c.push(s);
  };
  const doubled = /([b-df-hj-np-tv-z])\1$/;
  if (w.endsWith('ies')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) push(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) push(w.slice(0, -1));
  if (w.endsWith('ied')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    const b = w.slice(0, -2);
    push(b);
    push(b + 'e');
    if (doubled.test(b)) push(b.slice(0, -1));
  }
  if (w.endsWith('ing')) {
    const b = w.slice(0, -3);
    push(b);
    push(b + 'e');
    if (doubled.test(b)) push(b.slice(0, -1));
    if (b.endsWith('y')) push(b.slice(0, -1) + 'ie');
  }
  if (w.endsWith('ier')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('iest')) push(w.slice(0, -4) + 'y');
  if (w.endsWith('er')) {
    const b = w.slice(0, -2);
    push(b);
    push(b + 'e');
    if (doubled.test(b)) push(b.slice(0, -1));
  }
  if (w.endsWith('est')) {
    const b = w.slice(0, -3);
    push(b);
    push(b + 'e');
    if (doubled.test(b)) push(b.slice(0, -1));
  }
  if (w.endsWith('ily')) push(w.slice(0, -3) + 'y');
  if (w.endsWith('ly')) push(w.slice(0, -2));
  return c;
}

/**
 * Runtime lookup: strict first, then the shared fallback dictionaries,
 * then simple stemming. Never throws; returns null if nothing fits.
 */
export function resolve(
  token: string,
  start: boolean,
  primary: Dict[],
  fallback: Dict[] = [],
): Resolution | null {
  const strict = resolveStrict(token, start, primary);
  if (strict) return strict;
  const all = [...primary, ...fallback];
  const viaOthers = resolveStrict(token, start, fallback);
  if (viaOthers) return { ...viaOthers, approx: true };
  const lower = normalizeApostrophes(token).toLowerCase().replace(/'s$/, '');
  for (const cand of stemCandidates(lower)) {
    for (const d of all) {
      const v = d[cand];
      if (typeof v === 'string') return { key: cand, ru: v, approx: true };
    }
  }
  if (lower.includes('-')) {
    const parts = lower.split('-').map((p) => resolve(p, false, primary, fallback));
    if (parts.every(Boolean)) {
      return {
        key: lower,
        ru: parts.map((p) => p!.ru).join(' + '),
        approx: true,
      };
    }
  }
  return null;
}

/** All tappable words in a text, for coverage checks. */
export function wordsOf(q: string): { text: string; start: boolean }[] {
  return tokenize(q)
    .filter((s): s is Extract<Segment, { kind: 'word' }> => s.kind === 'word')
    .map((s) => ({ text: s.text, start: s.start }));
}
