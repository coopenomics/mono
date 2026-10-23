/**
 * Порты контура, которые запрашивает расширение «Стол разработчика» (ADR-16).
 *
 * Каталог приложений расширение зовёт само по HTTP, от ядра ему нужны только
 * журнал и реестр прав рабочего стола.
 */
import { DESKTOP_GRANTS_REGISTRY_PORT, LOGGER_PORT } from '@coopenomics/innercoop';

export const appsCatalogProxyPorts = {
  required: [
    DESKTOP_GRANTS_REGISTRY_PORT,
    LOGGER_PORT,
  ],
  optional: [],
};
