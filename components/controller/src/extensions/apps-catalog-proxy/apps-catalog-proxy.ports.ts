import {
  ACCESS_TOKEN_PORT,
  ACCOUNT_PORT,
  CHAIN_PORT,
  COOPERATIVE_VARS_PORT,
  DOCUMENT_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  PROVIDER_APPS_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

/**
 * Заявка папки apps-catalog-proxy: два расширения — «developer» (стол
 * разработчика) и «apps» («Приложения»). Цепь нужна столу «Приложения»:
 * оператор кооператива, его кошелёк у оператора и остаток AXON
 * читаются из цепи. Канал к провайдеру необязателен — без него витрина
 * показывает только встроенные расширения.
 *
 * Документы, реквизиты, учётные записи и опознание пайщика заявлены ради
 * приложений каталога в своих контейнерах (487-17): расширение принимает их
 * вызовы портов по сети и передаёт настоящим реализациям. Что из этого
 * доступно конкретному приложению, решает его собственная заявка.
 */
export const appsCatalogProxyPorts = {
  required: [
    DESKTOP_GRANTS_REGISTRY_PORT,
    LOGGER_PORT,
    VAULT_PORT,
    CHAIN_PORT,
    DOCUMENT_PORT,
    COOPERATIVE_VARS_PORT,
    ACCOUNT_PORT,
    ACCESS_TOKEN_PORT,
    // Уведомление председателю о запросе новых прав ядра приложения (487-37).
    NOTIFICATION_PORT,
  ],
  optional: [
    PROVIDER_APPS_PORT,
  ],
};
