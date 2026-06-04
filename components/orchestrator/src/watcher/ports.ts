/**
 * @fileoverview Порты on-chain watcher'а (Story 10.5).
 *
 * Watcher слушает события apps-contract в Коопеномиксе и автоматически
 * инициирует install/uninstall расширений для своего кооператива.
 * Source-of-truth для «что должно быть установлено» — блокчейн.
 *
 * Сервис {@link OnChainWatcherService} зависит только от этих
 * портов; реальные impl (RPC polling / parser2 client / etc.) лежат
 * рядом и подключаются в `WatcherModule`. Тесты подменяют порты
 * ин-мемори фейками — без реальной chain-ноды.
 */

/**
 * События apps-contract, релевантные orchestrator'у.
 *
 * Discriminated по `kind` — компилятор требует обработать каждый
 * вариант в switch'е.
 *
 *  - `release-published` (`apps::setrelease`) — кооперативу-оператору
 *    был выкачан новый релиз. Watcher проверяет scope (видна ли версия
 *    нашему кооперативу) и зовёт install pipeline.
 *  - `subscription-activated` (`apps::regsub` или `apps::extendsub`) —
 *    наш кооператив подписался на пакет (или продлил). Нужно
 *    дотянуть active-релиз и install'ить.
 *  - `release-withdrawn` (`apps::withdraw`) — релиз отозван.
 *    Если он сейчас активен — uninstall.
 *  - `subscription-expired` (`apps::expsub`) — подписка кончилась.
 *    Uninstall расширения.
 */
export type AppsContractEvent =
  | {
      kind: 'release-published';
      packageId: string;
      version: string;
      /** scope-тип релиза — см. apps-contract; `'cooperatives'` → дополнительная фильтрация в watcher. */
      scopeType: 'all' | 'subnets' | 'cooperatives' | 'empty';
      /** Если `scopeType='cooperatives'` — явный whitelist coopname'ов; иначе пусто. */
      scopeCoopnames?: ReadonlyArray<string>;
      blockNum: number;
    }
  | {
      kind: 'subscription-activated';
      coopname: string;
      packageId: string;
      expiresAtUnix: number;
      blockNum: number;
    }
  | {
      kind: 'release-withdrawn';
      packageId: string;
      version: string;
      blockNum: number;
    }
  | {
      kind: 'subscription-expired';
      coopname: string;
      packageId: string;
      blockNum: number;
    };

/**
 * Порт потока событий apps-contract. Реальный impl читает либо
 * parser2 Redis stream (`ce:parser2:<chain_id>:events` отфильтрованный
 * по contract=apps), либо poll'ит chain RPC `/v1/history/get_actions`.
 *
 * Контракт subscribe'а:
 *  - handler вызывается ровно один раз на каждое уникальное событие;
 *  - порядок — по блокам (старые first);
 *  - при ошибке в handler'е событие НЕ pop'ается из стрима до retry'я;
 *  - возвращаемый `unsubscribe` — синхронный, останавливает poll.
 */
export interface AppsContractEventStreamPort {
  subscribe(handler: (e: AppsContractEvent) => Promise<void>): Promise<{ unsubscribe(): void }>;
}

export const APPS_CONTRACT_EVENT_STREAM = Symbol('AppsContractEventStreamPort');

/**
 * Порт получения метаданных релиза из apps-catalog'а.
 *
 * On-chain event `setrelease` приносит только `(packageId, version, scopeType)`.
 * Чтобы реально запустить install pipeline, нужно знать `imageRef`,
 * `composeService`, `subgraphUrl` — они лежат в `coopenomics`-секции
 * package manifest'а в apps-catalog (Story 10.7a/b).
 *
 * Реальный impl бьёт по `GET /v1/package/:scope/:name/metadata` ca-auth'а
 * (Story 9.4.c) или по `/v1/registry/...` напрямую.
 */
export interface ReleaseMetadataPort {
  fetchInstallSpec(opts: {
    packageId: string;
    version: string;
  }): Promise<ReleaseInstallSpec | null>;
}

export interface ReleaseInstallSpec {
  /** Внутренний URL subgraph'а — для healthcheck'а и записи в registry. */
  url: string;
  /** OCI-ссылка образа в Nexus; если нет — frontend-only пакет, install не нужен. */
  imageRef?: string;
  /** Имя сервиса в docker-compose файле orchestrator'а. */
  composeService?: string;
  /** Путь к docker-compose файлу. */
  composeFile?: string;
}

export const RELEASE_METADATA_PORT = Symbol('ReleaseMetadataPort');
