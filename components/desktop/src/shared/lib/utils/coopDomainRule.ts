import { t } from 'src/shared/i18n';
import { env } from 'src/shared/config';
import { isDomain } from './isDomainRule';
import { isSubdomain } from './isSubdomainRule';

/**
 * Зона точек входа контура: `<учётное имя>.<зона>`. Имя из неё — значение
 * CNAME-записи, а не адрес кабинета. У каждого контура своя зона, потому что
 * кабинеты контуров стоят на разных L7-прокси: боевая — по умолчанию,
 * тестнет и контур разработки задают `CONNECTOR_ZONE`.
 */
export const DEFAULT_CONNECTOR_ZONE = 'connector.coopenomics.world';

export const connectorZone = (): string =>
  (env.CONNECTOR_ZONE || DEFAULT_CONNECTOR_ZONE).trim().replace(/\.$/, '').toLowerCase();

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
  const zone = connectorZone();
  if (value === zone || value.endsWith(`.${zone}`)) {
    return t('domain.connectorHost');
  }
  return true;
};
