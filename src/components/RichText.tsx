import { Fragment, type ReactNode } from 'react';

/** Inline **bold** support. */
export function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** Blank-line paragraphs, "- " bullet lines, single newlines as line breaks. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={className ? `rich ${className}` : 'rich'}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        // mixed: leading text lines then bullets
        const firstBullet = lines.findIndex((l) => l.trim().startsWith('- '));
        if (firstBullet > 0 && lines.slice(firstBullet).every((l) => l.trim().startsWith('- '))) {
          return (
            <Fragment key={bi}>
              <p>
                {lines.slice(0, firstBullet).map((l, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {inline(l)}
                  </Fragment>
                ))}
              </p>
              <ul>
                {lines.slice(firstBullet).map((l, li) => (
                  <li key={li}>{inline(l.trim().slice(2))}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
