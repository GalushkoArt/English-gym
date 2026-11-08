import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { resolve, tokenize, type Dict, type Resolution } from '../lib/lexicon.ts';
import { CORE, SHARED_GLOSSARY } from '../content/index.ts';

// ---- tiny global store for the single open word popover ----
interface PopoverState {
  word: string;
  res: Resolution | null;
  rect: { left: number; top: number; bottom: number; width: number };
  anchor: HTMLElement;
}
let popover: PopoverState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
export function closeWordPopover() {
  if (!popover) return;
  popover.anchor.setAttribute('aria-expanded', 'false');
  popover = null;
  emit();
}
function openWordPopover(p: PopoverState) {
  if (popover?.anchor === p.anchor) return closeWordPopover();
  if (popover) popover.anchor.setAttribute('aria-expanded', 'false');
  p.anchor.setAttribute('aria-expanded', 'true');
  popover = p;
  emit();
}
function usePopover() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => popover,
  );
}

export interface TappableTextProps {
  text: string;
  glossary?: Dict;
  /** Text to place into the gaps (after answering). */
  fill?: string[] | null;
  fillTone?: 'correct' | 'neutral';
  className?: string;
}

export function TappableText({ text, glossary, fill, fillTone = 'correct', className }: TappableTextProps) {
  const segments = tokenize(text);
  const dicts = glossary ? [glossary, CORE] : [CORE];

  const onWord = (e: React.MouseEvent<HTMLButtonElement>, word: string, start: boolean) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    openWordPopover({
      word,
      res: resolve(word, start, dicts, [SHARED_GLOSSARY]),
      rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width },
      anchor: el,
    });
  };

  const render = (s: (typeof segments)[number], i: number | string): React.ReactNode => {
    switch (s.kind) {
          case 'word':
            return (
              <button
                key={i}
                type="button"
                className="word"
                aria-haspopup="dialog"
                aria-expanded="false"
                onClick={(e) => onWord(e, s.text, s.start)}
              >
                {s.text}
              </button>
            );
          case 'gap': {
            const f = fill?.[s.index];
            return f ? (
              <span key={i} className={`gap filled ${fillTone}`}>
                {f}
              </span>
            ) : (
              <span key={i} className="gap" aria-label="пропуск">
                <span aria-hidden="true">&nbsp;</span>
              </span>
            );
          }
          case 'label':
            return (
              <span key={i} className="speaker" aria-label={`Говорит ${s.text}`}>
                {s.text}
              </span>
            );
          case 'br':
            return <br key={i} />;
          default:
            return <Fragment key={i}>{s.text}</Fragment>;
        }
  };

  // Glue punctuation to neighbouring words so "house." never breaks before the dot.
  // A text segment's leading non-space run attaches to the previous atom,
  // its trailing non-space run (e.g. an opening quote) to the next one.
  type Atom = { parts: React.ReactNode[]; glueNext: boolean };
  const atoms: Atom[] = [];
  let pendingPrefix: React.ReactNode[] = [];
  const pushAtom = (node: React.ReactNode, glueable: boolean) => {
    const last = atoms[atoms.length - 1];
    if (glueable && last?.glueNext) {
      last.parts.push(...pendingPrefix, node);
      last.glueNext = false;
    } else atoms.push({ parts: [...pendingPrefix, node], glueNext: false });
    pendingPrefix = [];
  };
  segments.forEach((s, i) => {
    if (s.kind !== 'text') return pushAtom(render(s, i), s.kind === 'word' || s.kind === 'gap');
    const last = atoms[atoms.length - 1];
    if (!/\s/.test(s.text)) {
      // e.g. "/" or "." between atoms without spaces: glue both ways
      if (last && last.parts.length) {
        last.parts.push(<Fragment key={`${i}g`}>{s.text}</Fragment>);
        last.glueNext = true;
      } else pendingPrefix.push(<Fragment key={`${i}g`}>{s.text}</Fragment>);
      return;
    }
    const [, lead, middle, trail] = /^(\S*)([\s\S]*?)(\S*)$/.exec(s.text)!;
    if (lead) {
      if (last) last.parts.push(<Fragment key={`${i}l`}>{lead}</Fragment>);
      else pendingPrefix.push(<Fragment key={`${i}l`}>{lead}</Fragment>);
    }
    if (last) last.glueNext = false;
    if (middle) atoms.push({ parts: [<Fragment key={`${i}m`}>{middle}</Fragment>], glueNext: false });
    if (trail) pendingPrefix.push(<Fragment key={`${i}t`}>{trail}</Fragment>);
  });
  if (pendingPrefix.length) atoms.push({ parts: pendingPrefix, glueNext: false });

  return (
    <span className={className ? `tappable ${className}` : 'tappable'}>
      {atoms.map((a, i) =>
        a.parts.length > 1 ? (
          <span key={i} className="nowrap">
            {a.parts}
          </span>
        ) : (
          <Fragment key={i}>{a.parts}</Fragment>
        ),
      )}
    </span>
  );
}

export function WordPopover() {
  const p = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);

  useEffect(() => {
    if (!p) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeWordPopover();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || p.anchor.contains(t)) return;
      closeWordPopover();
    };
    const onScroll = () => closeWordPopover();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [p]);

  useEffect(() => {
    if (!p || !ref.current) return setPos(null);
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 12;
    const vw = window.innerWidth;
    let left = p.rect.left + p.rect.width / 2 - w / 2;
    left = Math.max(margin, Math.min(left, vw - w - margin));
    const above = p.rect.top - h - 10 > margin;
    const top = above ? p.rect.top - h - 10 : p.rect.bottom + 10;
    setPos({ left, top, above });
  }, [p]);

  if (!p) return null;
  const lemma = p.res && p.res.key.toLowerCase() !== p.word.toLowerCase().replace(/[’']s$/, '') ? p.res.key : null;
  return (
    <div
      ref={ref}
      className={`word-pop${pos ? ' shown' : ''}${pos?.above ? ' above' : ' below'}`}
      role="dialog"
      aria-label={`Перевод: ${p.word}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
    >
      <div className="word-pop-head">
        <span className="word-pop-word" lang="en">
          {p.word}
        </span>
        {lemma && <span className="word-pop-lemma">→ {lemma}</span>}
      </div>
      <div className="word-pop-ru">{p.res ? p.res.ru : 'Перевод не найден'}</div>
    </div>
  );
}
