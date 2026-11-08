import type { Topic } from '../lib/types.ts';
import { RichText, inline } from './RichText.tsx';
import { Icon } from './Icon.tsx';

export function CheatSheet({ topic, compact }: { topic: Topic; compact?: boolean }) {
  return (
    <ul className={`cheat${compact ? ' compact' : ''}`}>
      {topic.cheat.map((line, i) => (
        <li key={i}>{formatFormula(line)}</li>
      ))}
    </ul>
  );
}

/** Highlight the part after "→" as the formula. */
function formatFormula(line: string) {
  const idx = line.indexOf('→');
  if (idx === -1 || line.indexOf('→', idx + 1) !== -1) return <span className="cheat-when">{inline(line)}</span>;
  return (
    <>
      <span className="cheat-when">{inline(line.slice(0, idx).trim())}</span>
      <span className="cheat-arrow" aria-hidden="true">
        →
      </span>
      <span className="cheat-then">{inline(line.slice(idx + 1).trim())}</span>
    </>
  );
}

export function RuleBlocks({ topic }: { topic: Topic }) {
  return (
    <div className="rules">
      {topic.rules.map((r, i) => (
        <section key={i} className="rule">
          <h3>
            <span className="rule-num">{i + 1}</span>
            {r.title}
          </h3>
          <RichText text={r.body} />
          {r.examples.length > 0 && (
            <ul className="examples">
              {r.examples.map((e, j) => (
                <li key={j}>
                  <span className="ex-en" lang="en">
                    {e.en}
                  </span>
                  <span className="ex-ru">{e.ru}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function Mistakes({ topic }: { topic: Topic }) {
  return (
    <ul className="mistakes">
      {topic.mistakes.map((m, i) => (
        <li key={i}>
          <div className="mk-row bad">
            <Icon name="x" size={16} />
            <span lang="en">{m.wrong}</span>
          </div>
          <div className="mk-row good">
            <Icon name="check" size={16} />
            <span lang="en">{m.right}</span>
          </div>
          <div className="mk-note">{m.note}</div>
        </li>
      ))}
    </ul>
  );
}

/** Full reference used inside the in-session drawer. */
export function RuleReference({ topic }: { topic: Topic }) {
  return (
    <div className="rule-ref">
      <h3 className="section-title">Шпаргалка</h3>
      <CheatSheet topic={topic} />
      <h3 className="section-title">Правило</h3>
      <RuleBlocks topic={topic} />
      <h3 className="section-title">Типичные ошибки</h3>
      <Mistakes topic={topic} />
    </div>
  );
}
