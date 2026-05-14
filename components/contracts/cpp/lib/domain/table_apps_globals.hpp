#pragma once

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include "../consts.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Общесистемные параметры каталога приложений (D2, FR2).
 *
 * Singleton — одна запись на контракт. Хранит четыре параметра pull-биллинга
 * и retry-каденса:
 *
 *  - `min_payment_period_seconds` — минимальный шаг pull-биллинга
 *    (обычно 1 час; используется при квантизации `charge.required`-периодов).
 *  - `free_trial_period_seconds` — период бесплатного использования
 *    после `regclient` до первого регулярного charge'а.
 *  - `lead_time_seconds` — за какое время до окончания текущего
 *    оплаченного интервала CA-watcher эмитит `charge.required` (D6).
 *  - `retry_max` — максимум transport-retry'ев при недоступности кабинета;
 *    после исчерпания CA переключается на суточный billing-retry с
 *    `attempt`-инкрементом (two-level retry pattern).
 *
 * Scope = `apps`-контракт (`get_self()`); singleton без PK.
 * RAM payer — `get_self()`. Изменения только через action `setglobals`.
 *
 * \see architecture-v2 D2 — почему singleton, а не поле в общей `coops`.
 * \see Story v2.1.1 — каркас (полная замена); v2.1.2 — валидация диапазонов.
 */
struct [[eosio::table, eosio::contract(APPS)]] globals_row {
  uint32_t min_payment_period_seconds = 0;
  uint32_t free_trial_period_seconds  = 0;
  uint32_t lead_time_seconds          = 0;
  uint8_t  retry_max                  = 0;
};

typedef eosio::singleton<"globals"_n, globals_row> globals_singleton;

} // namespace Apps
