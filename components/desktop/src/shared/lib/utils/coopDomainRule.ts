import { t } from 'src/shared/i18n';
import { isDomain } from './isDomainRule';
import { isSubdomain } from './isSubdomainRule';

/**
 * Зона точек входа платформы: `<учётное имя>.connector.coopenomics.world`.
 * Имя из неё — значение CNAME-записи, а не адрес кабинета.
 */
export const CONNECTOR_ZONE = 'connector.coopenomics.world';

/**
 * Адрес кабинета кооператива: поддомен собственного домена кооператива.
 * Имя из зоны точек входа отклоняется: оно и так ведёт на платформу, поэтому
 * проверка делегирования проходит сама собой, а у кооператива адреса нет.
 */
export const isCoopDomain = (val: any) => {
  const value = String(val ?? '').trim().replace(/\.$/, '').toLowerCase();
  if (!value) return t('domain.required');
  const domain = isDomain(value);
  if (domain !== true) return domain;
  const subdomain = isSubdomain(value);
  if (subdomain !== true) return subdomain;
  if (value === CONNECTOR_ZONE || value.endsWith(`.${CONNECTOR_ZONE}`)) {
    return t('domain.connectorHost');
  }
  return true;
};
