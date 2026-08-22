import type { MarketplaceWriteoffProposalView } from '../api';

// Русское склонение «позиция / позиции / позиций».
export function positionsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = 'позиций';
  if (mod10 === 1 && mod100 !== 11) word = 'позиция';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'позиции';
  return `${n} ${word}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

// Человеческое имя проекта списания — по дате подачи/цикла, не «N позиций».
export function proposalTitle(p: MarketplaceWriteoffProposalView): string {
  return `Списание от ${formatDate(p.submitted_at ?? p.cycle_started_at ?? p.updated_at)}`;
}
