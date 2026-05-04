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
 * Indexing:
 *  - PK `id` — auto-inc.
 *  - `bycooppkg` — composite (coopname, package_id) для idempotent upsert
 *    и проверки «есть ли активная подписка коопа X на пакет Y».
 *  - `bycoop` — все подписки одного кооператива.
 *  - `byexpires` — sorted by `end_at` для будущего auto-cleanup.
 *
 * \see lib/domain/table_apps_coops.hpp — chain_id ↔ кооператив.
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
