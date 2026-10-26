import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import type { CatalogApp } from 'src/entities/CatalogApp';

/**
 * Подписи приложения каталога — одни на карточку витрины, страницу
 * приложения и список установленных: цена, пробный срок и состояние
 * подписки читаются везде одинаково.
 */

export const formatRub = (rub: number): string => new Intl.NumberFormat('ru-RU').format(rub);

export const formatDay = (iso?: string | null): string =>
  iso ? formatDateToLocalTimezone(iso, 'DD.MM.YYYY') : '—';

/** «360 ₽ в месяц» либо «Бесплатно» при нулевой цене. */
export function catalogAppPrice(app: Pick<CatalogApp, 'rubPerMonth'>): string {
  return app.rubPerMonth > 0
    ? t('catalogApp.price.perMonth', { amount: formatRub(app.rubPerMonth) })
    : t('catalogApp.price.free');
}

/**
 * Одна пометка состояния: пробный период до даты, подключено, выключено,
 * не оплачено. Без подписки пометки нет — витрина говорит ценой.
 */
export function catalogAppState(app: CatalogApp): { label: string; variant: BaseBadgeVariant } | null {
  const s = app.subscription;
  if (!s) return null;
  switch (s.status) {
    case Zeus.ProviderAppSubscriptionStatus.TRIAL:
      return app.enabled
        ? { label: t('catalogApp.state.trialUntil', { date: formatDay(s.trialEndsAt ?? s.expiresAt) }), variant: 'info' }
        : { label: t('catalogApp.state.disabled'), variant: 'warn' };
    case Zeus.ProviderAppSubscriptionStatus.ACTIVE:
      return app.enabled
        ? { label: t('catalogApp.state.connected'), variant: 'pos' }
        : { label: t('catalogApp.state.disabled'), variant: 'warn' };
    case Zeus.ProviderAppSubscriptionStatus.EXPIRED:
      return { label: t('catalogApp.state.unpaid'), variant: 'neg' };
    default:
      return null;
  }
}
