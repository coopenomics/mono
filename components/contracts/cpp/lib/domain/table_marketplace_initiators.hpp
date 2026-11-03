#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @brief Инициатор кооперативного участка Стола заказов (задача 99D-21, КЭУ-3;
 * решение владельца 03.11.2026).
 *
 * Инициатор — пайщик, вложивший средства в участок по договору участия в
 * хозяйственной деятельности; ему достаётся доля экономии участка при расчёте
 * итога месяца (`closeperiod`). Сегодня инициатор совпадает с председателем
 * участка, но связь не жёсткая: председатель может сменяться, а инициатор
 * продолжает получать свою долю. Пока строки нет, инициатором считается
 * председатель участка из таблицы `branches`. На инвестиционном этапе здесь
 * появятся несколько инициаторов с долями.
 *
 * Одна строка на участок. Ставит администратор действием `setinitiator`.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: initiators
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] mkt_initiator {
  eosio::name braname;   ///< кооперативный участок (первичный ключ)
  eosio::name username;  ///< пайщик-инициатор участка

  uint64_t primary_key() const { return braname.value; }
};

typedef eosio::multi_index<"initiators"_n, mkt_initiator> mkt_initiators_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(mkt_initiator, contract);
