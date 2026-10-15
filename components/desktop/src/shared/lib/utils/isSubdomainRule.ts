import { t } from 'src/shared/i18n';

/**
 * Адрес кабинета — только поддомен (app.coop.ru): домен подключается
 * CNAME-записью на точку входа `<учётное имя>.connector.coopenomics.world`, а на
 * корень домена CNAME не ставится (#245, решение @ant 15.10.2026). Поддомен —
 * не меньше трёх частей имени. Корректность самого имени проверяет isDomain.
 */
export const isSubdomain = (val: any) => {
  const labels = String(val ?? '').trim().replace(/\.$/, '').split('.').filter(Boolean);
  return labels.length >= 3 || t('domain.subdomainRequired');
};
