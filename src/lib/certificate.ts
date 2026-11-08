// Draws a certificate onto a canvas for PNG download.
import type { CertResult } from './store.ts';
import { LEVEL_INFO } from '../content/index.ts';

const LEVEL_COLOR: Record<string, string> = { B1: '#1baf7a', B2: '#2a78d6', C1: '#eb6834' };

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCertificate(cert: CertResult, name: string): HTMLCanvasElement {
  const W = 2000;
  const H = 1414;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const font = (w: number, size: number) =>
    `${w} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
  const accent = LEVEL_COLOR[cert.level] ?? '#2a78d6';

  ctx.fillStyle = '#fbfbf9';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#14171f';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.strokeStyle = '#d9dbe0';
  ctx.lineWidth = 2;
  ctx.strokeRect(84, 84, W - 168, H - 168);
  ctx.fillStyle = accent;
  ctx.fillRect(60, 60, 18, H - 120);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5b6170';
  ctx.font = font(600, 34);
  ctx.fillText('ENGLISH GYM', 170, 210);
  ctx.textAlign = 'right';
  ctx.fillText(`№ ${cert.id}`, W - 170, 210);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#14171f';
  ctx.font = font(700, 110);
  ctx.fillText('Сертификат', 170, 400);
  ctx.fillStyle = '#5b6170';
  ctx.font = font(400, 44);
  ctx.fillText('о прохождении теста по грамматике английского языка', 170, 470);

  // level block
  ctx.fillStyle = accent;
  const bx = 170;
  const by = 560;
  ctx.beginPath();
  ctx.roundRect(bx, by, 220, 150, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = font(800, 96);
  ctx.textAlign = 'center';
  ctx.fillText(cert.level, bx + 110, by + 110);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#14171f';
  ctx.font = font(600, 54);
  ctx.fillText(LEVEL_INFO[cert.level].name, bx + 270, by + 70);
  ctx.fillStyle = '#5b6170';
  ctx.font = font(400, 38);
  ctx.fillText(`Результат ${Math.round(cert.score * 100)}% · ${cert.correct} из ${cert.total}`, bx + 270, by + 125);

  ctx.fillStyle = '#14171f';
  ctx.font = font(700, 80);
  const displayName = name.trim() || 'Участник тренажёра';
  const nameLines = wrap(ctx, displayName, W - 340).slice(0, 2);
  nameLines.forEach((l, k) => ctx.fillText(l, 170, 880 + k * 90));
  ctx.strokeStyle = '#d9dbe0';
  ctx.lineWidth = 2;
  const lineY = 880 + (nameLines.length - 1) * 90 + 40;
  ctx.beginPath();
  ctx.moveTo(170, lineY);
  ctx.lineTo(W - 170, lineY);
  ctx.stroke();

  ctx.fillStyle = '#5b6170';
  ctx.font = font(400, 36);
  ctx.fillText(`Дата: ${formatDate(cert.date)}`, 170, lineY + 80);
  ctx.font = font(400, 28);
  const note = 'Тест: 30 вопросов без подсказок, порог прохождения 80%. Сертификат подтверждает результат внутри тренажёра и не является официальным документом.';
  wrap(ctx, note, W - 340).forEach((l, k) => ctx.fillText(l, 170, H - 200 + k * 40));
  return c;
}

export function downloadCertificate(cert: CertResult, name: string) {
  const canvas = drawCertificate(cert, name);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-gym-${cert.level}-certificate.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
