#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include "../consts.hpp"

/**
 * @brief Настройки экономики кооперативных участков (задача 99D-20, КЭУ-2;
 * решение владельца 03.11.2026).
 *
 * `aid_month_limit` — потолок резерва социально-экономического обеспечения на
 * одного получателя в месяц: верхняя граница строки `reserves`. Ноль — резерв
 * выключен: строки резерва завести нельзя, материальная помощь выплачивается
 * без предела, как до задачи (так работает прежний ИСТОК после обновления
 * контрактов). Ставит администратор действием `setaidlimit`, один на все
 * участки кооператива.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: brnconfig
 */
struct [[eosio::table, eosio::contract(BRANCH)]] brnconfig {
  eosio::asset aid_month_limit;  ///< потолок резерва на получателя в месяц; ноль — резерв выключен
};

typedef eosio::singleton<"brnconfig"_n, brnconfig> brnconfig_singleton;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(brnconfig, contract);
