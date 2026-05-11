#pragma once

#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Запись каталога: подписка кооператива на пакет.
 *
 * Идентификация подписки — composite `(coopname, package_id, chain_id)`:
 *  - `coopname` — кто подписан (Antelope name).
 *  - `package_id` — на какой пакет.
 *  - `chain_id` — в какой подсети действует подписка. Контракт `apps`
 *    деплоится на корневой координационной KE-цепи и обслуживает
 *    несколько подсетей; chain_id привязывает подписку к конкретной
 *    подсети, в которой кооператив находится.
 *
 * `plan` — имя плана (`basic`, `premium`, ...). Это **только метка**:
 * биллинг (расчёт стоимости, приём оплаты, выставление счёта) — задача
 * кабинета ВОСХОД и контракта `pay.coopenomics`. Сюда приходит уже факт
 * «подписка активна с X по Y по плану Z».
 *
 * `regsub` идемпотентно по `(coopname, package_id)`: повторный вызов с
 * тем же ключом продлевает `end_at` (= `max(текущее, новое)`) и
 * обновляет `plan`/`active`. Это поведение сознательное — биллинг при
 * retry не должен бояться дубликатов.
 *
 * `expsub` НЕ удаляет row, а ставит `active=false`. Запись остаётся
 * для аудита истечения подписки. Cleanup просроченных записей — задача
 * отдельного периодического действия (вне MVP).
 *
 * **D4 v2-extension** — два новых поля для координации pull-биллинга
 * (Story v2.6 / D4 / D5):
 *  - `attempt` — billing-retry counter уровня `regsub`. Инкрементируется
 *    pricing-watcher'ом CA через `setattempt`, когда `ack=declined`
 *    или charge провалился. Сбрасывается в `0` при успешном `extendsub`.
 *  - `last_charge_intent_id` — UUIDv5 последнего применённого
 *    charge.intent. Используется `extendsub` для double-emit prevention:
 *    повторный вызов с тем же id отсекается `eosio_assert("already extended")`.
 *    Дефолт — нулевой checksum256 (т.е. ещё ни одного extend не было).
 *
 * Поля добавлены в конец struct'а как nullable-by-default — старые
 * MVP-row'ы (если бы они были) интерпретировались бы с `attempt=0` и
 * нулевым `last_charge_intent_id`. Pre-deploy guard
 * `scripts/v2-migration-guard.ts` (Story v2.7.5) блокирует прод-деплой
 * при count > 0 production-scope записей, чтобы исключить
 * deserialization-сюрпризы; в MVP/dev таблица пустая и миграция
 * безопасна.
 *
 * Indexing:
 *  - PK `id` — auto-inc.
 *  - `bycooppkg` — composite (coopname, package_id) для idempotent upsert
 *    и проверки «есть ли активная подписка коопа X на пакет Y».
 *  - `bycoop` — все подписки одного кооператива.
 *  - `byexpires` — sorted by `end_at` для будущего auto-cleanup.
 *
 * \see lib/domain/table_apps_coops.hpp — chain_id ↔ кооператив.
 * \see architecture-v2 D4 — runtime-nullable migration policy.
 * \see architecture-v2 D5 — UUIDv5-based double-emit prevention.
 */
struct [[eosio::table, eosio::contract(APPS)]] sub {
  uint64_t          id;
  name              coopname;
  name              package_id;
  checksum256       chain_id;
  name              plan;
  bool              active;
  time_point_sec    start_at;
  time_point_sec    end_at;
  time_point_sec    created_at;
  time_point_sec    updated_at;
  uint8_t           attempt = 0;                  ///< D4: billing-retry counter
  checksum256       last_charge_intent_id = {};   ///< D4: UUIDv5 последнего extendsub

  uint64_t  primary_key()  const { return id; }
  uint128_t by_cooppkg()   const { return ((uint128_t)coopname.value << 64) | package_id.value; }
  uint64_t  by_coop()      const { return coopname.value; }
  uint64_t  by_expires()   const { return end_at.sec_since_epoch(); }
};

typedef eosio::multi_index<
    "subs"_n, sub,
    eosio::indexed_by<"bycooppkg"_n, eosio::const_mem_fun<sub, uint128_t, &sub::by_cooppkg>>,
    eosio::indexed_by<"bycoop"_n,    eosio::const_mem_fun<sub, uint64_t,  &sub::by_coop>>,
    eosio::indexed_by<"byexpires"_n, eosio::const_mem_fun<sub, uint64_t,  &sub::by_expires>>>
    subs_index;

} // namespace Apps
