import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import type { ChainTableRef } from 'src/shared/lib/realtime';
import { t } from '../../../i18n';

/** Состояние шаблона → подпись и цвет бейджа. */
export function templateStatusView(status: Zeus.GreetingTemplateStatus): { label: string; variant: BaseBadgeVariant } {
  return status === Zeus.GreetingTemplateStatus.ACTIVE
    ? { label: t('greetings.status.active'), variant: 'pos' }
    : { label: t('greetings.status.draft'), variant: 'neutral' };
}

const SEND_VIEW: Record<Zeus.GreetingSendStatus, { key: string; variant: BaseBadgeVariant }> = {
  [Zeus.GreetingSendStatus.SENT]: { key: 'greetings.status.sent', variant: 'pos' },
  [Zeus.GreetingSendStatus.SKIPPED]: { key: 'greetings.status.skipped', variant: 'warn' },
  [Zeus.GreetingSendStatus.FAILED]: { key: 'greetings.status.failed', variant: 'neg' },
};

/** Итог поздравления → подпись и цвет бейджа. */
export function sendStatusView(status: Zeus.GreetingSendStatus): { label: string; variant: BaseBadgeVariant } {
  const view = SEND_VIEW[status];
  return { label: t(view.key as never), variant: view.variant };
}

/** Причина пропуска поздравления. */
export function skipReasonLabel(reason: Zeus.GreetingSkipReason | null | undefined): string {
  return reason ? t(`greetings.reason.${reason.toLowerCase()}` as never) : '';
}

export function accountTypeLabel(type: Zeus.GreetingAccountType): string {
  return t(`greetings.accountType.${type.toLowerCase()}` as never);
}

/** `ГГГГ-ММ-ДД` → `ДД.ММ.ГГГГ`; дата без года — `ДД.ММ`. */
export function formatDay(date: string, withYear = true): string {
  const [year, month, day] = date.slice(0, 10).split('-');
  return withYear ? `${day}.${month}.${year}` : `${day}.${month}`;
}

/** Момент времени → `ДД.ММ.ГГГГ ЧЧ:ММ` по местному времени стола. */
export function formatMoment(value: string | Date): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Таблицы приложения в ленте изменений: страницы перечитываются по сигналу. */
export const GREETINGS_LIVE: Record<'templates' | 'calendar' | 'sends', ChainTableRef> = {
  templates: { code: 'greetings', table: 'greetings_templates' },
  calendar: { code: 'greetings', table: 'greetings_calendar' },
  sends: { code: 'greetings', table: 'greetings_sends' },
};
export * from './access';
