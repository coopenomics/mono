#pragma once

#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>
#include <optional>

#include "../lib/index.hpp"

using namespace Apps;

/**
\defgroup public_apps Контракт APPS

* Смарт-контракт каталога приложений `apps` — координационная плоскость
* для платформы Каталога приложений ВОСХОД (`apps-catalog`). Контракт
* деплоится на корневой KE-цепи и обслуживает несколько подсетей
* (одна установка `CA-auth` → N подсетей кооперативов).
*
* Что хранит:
*  - `packages` — реестр зарегистрированных пакетов (PK = `name`).
*  - `releases` — текущие active + недавние superseded релизы (TTL 90 дней).
*  - `subs` — подписки кооперативов на пакеты (`coopname × package_id × chain_id`).
*  - `coops` — кооперативы, подключённые к каталогу, со своими
*    subnet-signing-key и chain_id подсети.
*
* Чего контракт НЕ делает (намеренно):
*  - Не проверяет ECDSA-подписи `signed-request`'ов от DC — это off-chain
*    в `CA-auth`, который читает `coops.signing_key` через RPC.
*  - Не выпускает JWT — это HS256 в `CA-auth`.
*  - Не валидирует tarball — `tarball_sha256` хранится для аудита.
*  - Не считает биллинг — биллинг живёт в кабинете ВОСХОД и `pay.coopenomics`,
*    сюда приходит уже факт «подписка активна».
*  - Не пишет audit-log — Antelope сам пишет в trace; `CA` ведёт свой
*    `audit_log_admin` для off-chain событий.
*
* Authorization model (MVP, упрощённая):
*  - Все mutating actions требуют `<coopname>@active`.
*  - Разделение прав на `@billing`, `@subnet-operator` и т.п. — TODO,
*    введём через `eosio.msig` миграцию когда биллинг отделится от
*    провайдера каталога.
*  - `cleanup` — без auth: операция идемпотентна и удаляет только
*    TTL-просроченные `superseded` записи.
*
* \see /home/admin/apps-catalog/docs/architecture.md
* \see epics.md Story 6.x (KE bootstrap)
*/

/**
\defgroup public_apps_processes Процессы
\ingroup public_apps
*/

/**
\defgroup public_apps_actions Действия
\ingroup public_apps
*/

/**
\defgroup public_apps_tables Таблицы
\ingroup public_apps
*/

/**
\defgroup public_apps_consts Константы
\ingroup public_apps
*/

namespace Apps {
/**
 * Окно retention для `superseded`-релизов: 90 дней. Записи старше
 * этого окна удаляются inline в `setrelease` или явным `cleanup`.
 * `withdrawn` под TTL не подпадают — отзыв делается сознательно
 * и должен быть видим до явного purge.
 */
static constexpr uint64_t RELEASE_RETENTION_SECS = 90 * 86400;

/**
 * Бюджет cleanup'а внутри одного вызова `setrelease`: не удалять
 * больше N записей за раз, чтобы не упереться в CPU-limit транзакции.
 * Остаток подметёт следующий `setrelease` или явный `cleanup(package_id)`.
 */
static constexpr uint64_t CLEANUP_BUDGET_PER_CALL = 50;
} // namespace Apps

class [[eosio::contract(APPS)]] apps : public eosio::contract {

public:
  apps(eosio::name receiver, eosio::name code,
       eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  [[eosio::action]] void migrate();

  // ─── packages ───────────────────────────────────────────────────────

  /**
   * \brief Зарегистрировать новый пакет в каталоге.
   * \param coopname  провайдер каталога (тот, кто подписал транзакцию).
   * \param package_id  кодовое имя пакета (Antelope name, ≤12 chars).
   * \param package_name  внешнее имя (npm/go/oci) — может содержать `@scope/name`.
   * \param owner  username владельца пакета.
   * \param compatible_subnets  human-labels подсетей, в которых пакет совместим.
   * \note Авторизация: @p coopname @ active. Идемпотентность: фейл, если
   *       package_id уже зарегистрирован (нужен явный transferpkg/withdraw
   *       перед re-регистрацией).
   */
  [[eosio::action]] void regpackage(eosio::name coopname,
                                    eosio::name package_id,
                                    std::string package_name,
                                    eosio::name owner,
                                    std::vector<eosio::name> compatible_subnets);

  /**
   * \brief Передать владение пакетом другому пользователю (FR3).
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void transferpkg(eosio::name coopname,
                                     eosio::name package_id,
                                     eosio::name new_owner);

  // ─── releases ───────────────────────────────────────────────────────

  /**
   * \brief Опубликовать новый release пакета.
   *
   * Атомарно (FR8 «approve → release.ACTIVE»):
   *  1. Создаёт row в `releases` со `status=active`, `superseded_at=0`.
   *  2. Любой существующий `active` с тем же `(package_id, scope)` →
   *     `superseded`, `superseded_at=now`.
   *  3. Если `scope.kind == "all"` — обновляет `packages.last_active_version`.
   *  4. Inline-cleanup: удаляет до `CLEANUP_BUDGET_PER_CALL` самых старых
   *     `superseded`-записей с `superseded_at < now - RELEASE_RETENTION_SECS`.
   *
   * \param scope  область видимости (см. `scope_t`).
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void setrelease(eosio::name coopname,
                                    eosio::name package_id,
                                    std::string version,
                                    Apps::scope_t scope,
                                    eosio::checksum256 tarball_sha256,
                                    eosio::name moderated_by,
                                    std::string meta);

  /**
   * \brief Реактивировать предыдущую версию пакета (FR43).
   * \details Находит release по `(package_id, version)`; ставит ему
   *          `status=active`, `superseded_at=0`. Текущий `active` с тем же
   *          scope → `superseded`. Если scope=all — обновляет
   *          `packages.last_active_version`.
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void reactivate(eosio::name coopname,
                                    eosio::name package_id,
                                    std::string version);

  /**
   * \brief Отозвать релиз (CVE / нарушение / юридический отзыв).
   * \details Ставит `status=withdrawn`. Если это был `active` со scope=all —
   *          `packages.last_active_version` обнуляется ("") до следующего
   *          setrelease/reactivate.
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void withdraw(eosio::name coopname,
                                  eosio::name package_id,
                                  std::string version,
                                  std::string reason);

  /**
   * \brief Ручной cleanup TTL-просроченных `superseded`-записей пакета.
   * \details Удаляет до `CLEANUP_BUDGET_PER_CALL` записей с
   *          `superseded_at < now - RELEASE_RETENTION_SECS`. Идемпотентен.
   * \note Без авторизации: операция доброкачественная, удаляет только
   *       уже невидимые в продакшене записи. Любой может вызвать
   *       (и заплатить за CPU).
   */
  [[eosio::action]] void cleanup(eosio::name package_id);

  // ─── subscriptions ──────────────────────────────────────────────────

  /**
   * \brief Зарегистрировать или продлить подписку кооператива на пакет.
   * \details Idempotent по (coopname, package_id):
   *          - row не существует → создаём с `active=true`.
   *          - row существует    → обновляем `plan`, `end_at` = max(текущее, новое),
   *                                `active=true`, `chain_id` (на случай переноса
   *                                между подсетями).
   * \param coopname  провайдер каталога (тот, кто выписывает подписку).
   * \param subscriber  кооператив-подписчик.
   * \param chain_id  подсеть, в которой действует подписка.
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void regsub(eosio::name coopname,
                                eosio::name subscriber,
                                eosio::name package_id,
                                eosio::checksum256 chain_id,
                                eosio::name plan,
                                eosio::time_point_sec start_at,
                                eosio::time_point_sec end_at);

  /**
   * \brief Деактивировать подписку (`active=false`); row не удаляется
   *        (нужен для аудита истечения).
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void expsub(eosio::name coopname,
                                eosio::name subscriber,
                                eosio::name package_id);

  // ─── coops ──────────────────────────────────────────────────────────

  /**
   * \brief Зарегистрировать кооператив в каталоге.
   * \details Этот action — часть процесса подключения коопа к каталогу
   *          приложений на Восходе (вне scope текущего MVP). Кооператив
   *          сам подписывает транзакцию (`require_auth(coopname)`),
   *          подтверждая, что владеет приватной частью `signing_key`.
   * \param coopname  кооператив, который регистрируется.
   * \param chain_id  подсеть, к которой принадлежит коопе.
   * \param subnet_label  human-label подсети ("ru","by",...).
   * \param signing_key  subnet-signing-key (отдельный от @ active).
   * \note Авторизация: @p coopname @ active. Идемпотентность: фейл, если
   *       уже зарегистрирован — для обновления использовать `setcoop`.
   */
  [[eosio::action]] void regcoop(eosio::name coopname,
                                 eosio::checksum256 chain_id,
                                 eosio::name subnet_label,
                                 eosio::public_key signing_key);

  /**
   * \brief Обновить параметры кооператива (ротация ключа, перенос подсети,
   *        деактивация).
   * \details Все параметры опциональны — обновляются только переданные.
   *          При смене `signing_key` обновляется `key_rotated_at=now`.
   *          Ранее выпущенные JWT (TTL 14 дней) остаются валидны;
   *          новые signed-request'ы должны идти от нового приват-ключа.
   * \note Авторизация: @p coopname @ active.
   */
  [[eosio::action]] void setcoop(eosio::name coopname,
                                 std::optional<eosio::checksum256> chain_id,
                                 std::optional<eosio::name> subnet_label,
                                 std::optional<eosio::public_key> signing_key,
                                 std::optional<bool> active);

  // ─── pricing & globals (v2.1) ───────────────────────────────────────

  /**
   * \brief Установить ставку плана `plan` для пакета `package_id` (FR1, D1).
   * \details Per-plan upsert в таблице `pricings` (scope = `package_id`):
   *          row нет → `emplace`; row есть → `modify` с обновлённым
   *          `hourly_rate` и `updated_at` = текущее время блока.
   *          RAM payer — `get_self()` (`apps`-контракт; ВОСХОД как owner
   *          аккаунта оплачивает RAM координационной плоскости).
   *
   *          Story v2.1.1 — каркас без бизнес-валидации. Полная валидация
   *          (`hourly_rate.amount > 0`, символ против `_root_govern_symbol`,
   *          plan-whitelist, snapshot предыдущей ставки в audit_log_admin)
   *          добавляется в Story v2.1.2.
   *
   * \param package_id  scope таблицы `pricings` (Antelope `name`).
   * \param plan        имя плана, PK (в MVP всегда `default`).
   * \param hourly_rate ставка за час (общая валюта экосистемы — RUB,4).
   * \note Авторизация: `require_auth(get_self())` — действие выполняется
   *       контрактом от своего имени по запросу из `CA-admin` через
   *       `KE write-adapter` (Story v2.1.3).
   */
  [[eosio::action]] void setpricing(eosio::name package_id,
                                    eosio::name plan,
                                    eosio::asset hourly_rate);

  /**
   * \brief Установить общесистемные параметры каталога (FR2, D2).
   * \details Полная замена singleton `globals` (scope = `get_self()`):
   *          row нет → создаём, есть → перезаписываем все четыре поля.
   *          RAM payer — `get_self()`. Story v2.1.1 — каркас без
   *          валидации диапазонов; валидация и snapshot предыдущего
   *          state'а добавляются в Story v2.1.2.
   *
   * \note Авторизация: `require_auth(get_self())`.
   */
  [[eosio::action]] void setglobals(uint32_t min_payment_period_seconds,
                                    uint32_t free_trial_period_seconds,
                                    uint32_t lead_time_seconds,
                                    uint8_t  retry_max);

  // ─── clients (multi-tenant onboarding, v2.4) ────────────────────────

  /**
   * \brief Зарегистрировать кооператив-клиента каталога (FR7, D3).
   * \details `clients`-row {scope=catalog_operator, PK=client_coopname}
   *          с `registered_at = now`. Идемпотентность строгая: повторный
   *          вызов на ту же пару → `eosio_assert("client already registered")`.
   *          RAM payer — `catalog_operator` (ВОСХОД оплачивает onboarding).
   * \param catalog_operator  оператор каталога, подписывает транзакцию
   *                          и платит RAM (в MVP всегда `voskhod`).
   * \param client_coopname   кооператив, который подключается к каталогу.
   * \note Авторизация: `require_auth(catalog_operator)`.
   */
  [[eosio::action]] void regclient(eosio::name catalog_operator,
                                   eosio::name client_coopname);

  /**
   * \brief Отозвать кооператив-клиента каталога (FR8, D3).
   * \details Удаляет row по PK; row нет → `eosio_assert("client not found")`
   *          (не идемпотентно сознательно — отличаем «уже отзывали» от
   *          «никогда не регистрировали»). Эффекты на CA-стороне:
   *          инвалидация membership-cache (D9 hybrid TTL) + добавление
   *          активных JWT в `JwtRevokeList` (FR15) живут off-chain.
   * \note Авторизация: `require_auth(catalog_operator)`.
   */
  [[eosio::action]] void delclient(eosio::name catalog_operator,
                                   eosio::name client_coopname);

  // ─── subscription extend / retry-counter (D4, v2.5/v2.6) ────────────

  /**
   * \brief Идемпотентно продлить подписку через `charge_intent_id` (FR24, D4, D5).
   * \details Находит `regsub` по `(subscriber, package_id)`; проверяет,
   *          что `last_charge_intent_id != charge_intent_id`. Иначе —
   *          `eosio_assert("already extended")` (это **ok-сигнал** для
   *          recovery-worker'а: дубль ack'а из кабинета или повтор после
   *          CA-crash). На успешном пути:
   *            - `end_at += period_seconds` (extend от текущей границы,
   *              не от now — important для непрерывности подписки),
   *            - `last_charge_intent_id = charge_intent_id`,
   *            - `attempt = 0` (счётчик retry'ев сбрасывается на удачном
   *              charge'е),
   *            - `updated_at = now`.
   *
   *          Story v2.5.2 (TS write-port `extendByChargeIntent`) ожидает
   *          именно эту семантику; `AlreadyExtendedError` маппится с
   *          on-chain assert'а.
   *
   * \param catalog_operator  оператор каталога (платит RAM, подписывает).
   * \param subscriber        кооператив-подписчик.
   * \param package_id        пакет.
   * \param period_seconds    на сколько продлить (в секундах). Должен быть > 0.
   * \param charge_intent_id  UUIDv5 от `(coopname, package_id, period_start_at)`.
   * \note Авторизация: `require_auth(catalog_operator)`.
   */
  [[eosio::action]] void extendsub(eosio::name catalog_operator,
                                   eosio::name subscriber,
                                   eosio::name package_id,
                                   uint32_t period_seconds,
                                   eosio::checksum256 charge_intent_id);

  /**
   * \brief Установить `attempt`-счётчик для подписки (D4 retry-management).
   * \details Простая запись uint8 в существующую `regsub`-row. Используется
   *          pricing-watcher'ом CA, когда `ack=declined` или charge провалился
   *          (типичный путь: `setattempt(coopname, package_id, current+1)`).
   *          Каскад с `extendsub` не нужен — последний сам сбросит attempt
   *          в 0 при успехе.
   *
   *          Альтернатива (on-chain incrattempt без передачи нового значения)
   *          могла бы избежать сравнения counter'ов на гонках, но усложняет
   *          контракт и редко полезна: pricing-watcher tick — единственный
   *          путь, и он сериализован per-(coopname, package_id) на стороне
   *          watcher-state в Postgres.
   *
   * \note Авторизация: `require_auth(catalog_operator)`.
   */
  [[eosio::action]] void setattempt(eosio::name catalog_operator,
                                    eosio::name subscriber,
                                    eosio::name package_id,
                                    uint8_t attempt);

  // ─── service tables ─────────────────────────────────────────────────

  struct [[eosio::table, eosio::contract(APPS)]] counts : counts_base {};
};
