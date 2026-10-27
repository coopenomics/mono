import {
  CHAIN_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  LOGGER_PORT,
  PROVIDER_APPS_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

/**
 * Заявка папки apps-catalog-proxy: два расширения — «developer» (стол
 * разработчика) и «apps» («Приложения»). Цепь нужна столу «Приложения»:
 * оператор кооператива, его кошелёк у оператора и остаток AXON
 * читаются из цепи. Канал к провайдеру необязателен — без него витрина
 * показывает только встроенные расширения.
 */
export const appsCatalogProxyPorts = {
  required: [
    DESKTOP_GRANTS_REGISTRY_PORT,
    LOGGER_PORT,
    VAULT_PORT,
    CHAIN_PORT,
  ],
  optional: [
    PROVIDER_APPS_PORT,
  ],
};
