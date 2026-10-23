/**
 * Порты контура, которые запрашивает расширение «Стол разработчика» (ADR-16).
 *
 * Каталог приложений расширение зовёт само по HTTP, от ядра ему нужны журнал,
 * реестр прав рабочего стола и ключ входа в каталог из хранилища узла
 * (`<coop>@catalog`, им транзакцию не подписать). Подписку на приложение
 * оформляет провайдер — порт есть только на узле оператора.
 */
import { DESKTOP_GRANTS_REGISTRY_PORT, LOGGER_PORT, PROVIDER_APPS_PORT, VAULT_PORT } from '@coopenomics/innercoop';

export const appsCatalogProxyPorts = {
  required: [
    DESKTOP_GRANTS_REGISTRY_PORT,
    LOGGER_PORT,
    VAULT_PORT,
  ],
  optional: [
    PROVIDER_APPS_PORT,
  ],
};
