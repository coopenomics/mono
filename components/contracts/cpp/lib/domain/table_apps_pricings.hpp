#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Прайс-лист пакета: `{plan -> hourly_rate}` (D1, FR1, AR5).
 *
 * Pricing-as-source on-chain: ставка плана хранится в блокчейне и читается
 * каталогом через parser2 read-adapter без локального shadow-state.
 * Изменения операторских цен через action `setpricing` атомарно
 * фиксируют `hourly_rate` и `updated_at`-снапшот для аудита.
 *
 * Идентификация:
 *  - scope = `package_id` (один shard на пакет).
 *  - PK    = `plan.value` (в MVP всегда `default`; tier-планы добавляются
 *            записями в тот же scope без миграции).
 *
 * RAM payer — `apps`-контракт (`get_self()`). Фактически оплачивается
 * ВОСХОДом как owner аккаунта `apps` (catalog-operator). Кооперативы-клиенты
 * за хранение прайс-листа не платят — это часть инварианта
 * «координацию оплачивает оператор каталога».
 *
 * \see /home/admin/apps-catalog/docs/architecture-v2-pricing-multitenancy.md
 *      D1 (Layout `pricings`-таблицы — scope-based per package).
 * \see Story v2.1.1 — каркас; v2.1.2 — валидация и snapshot policy.
 */
struct [[eosio::table, eosio::contract(APPS)]] pricing {
  name           plan;          ///< primary key (Antelope name, ≤12 chars)
  asset          hourly_rate;   ///< ставка за час (общая валюта экосистемы)
  time_point_sec updated_at;    ///< таймштамп последнего `setpricing`

  uint64_t primary_key() const { return plan.value; }
};

typedef eosio::multi_index<"pricings"_n, pricing> pricings_index;

} // namespace Apps
