import { platformSettings } from '@coopenomics/extension-kit';
import { NETWORK_OPERATOR_COOPNAME } from './registry.types';

/**
 * Эта установка — оператор сети: по имени кооператива либо по флагу в настройках.
 *
 * Имя главнее флага: оператор один, и требовать от него ставить галочку значило бы держать
 * в настройках поле, которое всем прочим включать нельзя. Флаг остаётся для тестового
 * контура, где оператором назначают другой кооператив.
 */
export const isNetworkOperator = (config: { announce_as_operator?: boolean }): boolean =>
  Boolean(config.announce_as_operator) || platformSettings().coopname === NETWORK_OPERATOR_COOPNAME;
