#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @brief Материальная помощь получателя за текущий месяц (задача 99D-20, КЭУ-2).
 *
 * С задачи 99D-34 накопитель не пишется: предел заявления — накопленное
 * право в строке резерва (`reserves.outstanding`). Таблица читается только
 * для строк резерва, записанных до 99D-34: их право на текущий период —
 * сумма строки минус поданное по накопителю. Строки стираются, когда старых
 * строк резерва не останется (отдельная задача).
 *
 * Накопитель для проверки предела: сумма заявлений получателя за месяц не
 * выше его резерва социально-экономического обеспечения (`reserves.amount`).
 * Период — `Branch::aid_period`: в рабочем режиме календарный месяц времени
 * блока по UTC (год × 12 + месяц), на стенде со сжатым временем — отрезок
 * длины `brnconfig.aid_period_seconds`. Истории нет: при первом заявлении
 * нового периода строка перезаписывается нулём.
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
