import type { MarketplaceWriteoffProposalView } from '../api';
import { t, uiLocale, t as i18nT } from 'src/shared/i18n';

// Русское склонение «позиция / позиции / позиций».
export function positionsLabel(n: number): string {
  return t('marketplace.writeoff.positions', n);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(uiLocale());
}

// Человеческое имя проекта списания — по дате подачи/цикла, не «N позиций».
export function proposalTitle(p: MarketplaceWriteoffProposalView): string {
  return i18nT('marketplace.writeoffProposalDisplay.title', { date: formatDate(p.submitted_at ?? p.cycle_started_at ?? p.updated_at) });
}
