#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @brief Материальная помощь получателя за текущий месяц (задача 99D-20, КЭУ-2).
 *
 * Накопитель для проверки предела: сумма заявлений получателя за календарный
 * месяц не выше его резерва социально-экономического обеспечения
 * (`reserves.amount`). Период — месяц времени блока по UTC
 * (`Branch::utc_month_period`): год × 12 + месяц. Истории нет: при первом
 * заявлении нового месяца строка перезаписывается нулём.
 *
 * Одна строка на получателя; живёт только пока потолок резерва включён и
 * получатель подаёт заявления.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: aidmonths
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_aidmonth {
  eosio::name  username;  ///< получатель материальной помощи (первичный ключ)
  uint32_t     period;    ///< месяц по UTC: год × 12 + месяц
  eosio::asset total;     ///< сумма поданных заявлений за этот месяц

  uint64_t primary_key() const { return username.value; }
};

typedef eosio::multi_index<"aidmonths"_n, branch_aidmonth> branch_aidmonths_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(branch_aidmonth, cooperative);
