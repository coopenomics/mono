#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @brief Резерв социально-экономического обеспечения пайщика кооперативного
 * участка (задача 99D-20, КЭУ-2; решение владельца 03.11.2026).
 *
 * Временная замена оплаты труда до модуля трудоустройства: председатель
 * участка записывает по каждому получателю — себе и доверенным лицам — сумму
 * материальной помощи в месяц. Суммы произвольны, усреднения нет; потолок
 * одной строки задаёт администратор (`brnconfig.aid_month_limit`).
 *
 * Строка служит двум целям:
 *  - накопленное право получателя на материальную помощь (задача 99D-34,
 *    решение владельца 10.11.2026): помощь временно играет роль оплаты труда,
 *    право копится каждый период на сумму строки и уменьшается на поданные
 *    заявления; невзятое не сгорает. Предел заявления — накопленное право
 *    (проверяет `createaid`);
 *  - слагаемое цели резерва участка в расчёте итога месяца Стола заказов:
 *    сумма накопленного права получателей участка (читает контракт marketplace).
 *
 * Право ведётся лениво, без обхода по периодам: строка помнит номер периода,
 * по который право начислено, и остаток на тот период. На любой другой
 * период право = остаток + сумма строки × число прошедших периодов. Строки,
 * записанные до 99D-34, этих полей не имеют: их право на текущий период —
 * сумма строки минус поданное за период по накопителю `aidmonths`.
 *
 * Одна строка на пару участок + получатель; истории нет, при снятии
 * доверенного или удалении участка строки стираются.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: reserves
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_reserve {
  uint64_t     id;        ///< суррогатный ключ (scope coopname)
  eosio::name  braname;   ///< кооперативный участок
  eosio::name  username;  ///< получатель: председатель либо доверенное лицо участка
  eosio::asset amount;    ///< резерв в месяц, не выше потолка кооператива

  // Хвост строки — только binary_extension: строки, записанные до 99D-34,
  // читаются без этих полей. Поля пишутся всегда вместе.
  eosio::binary_extension<uint32_t>     accrued_period;  ///< период, по который начислено право (включительно)
  eosio::binary_extension<eosio::asset> outstanding;     ///< накопленное право на этот период: начислено минус подано

  uint64_t  primary_key() const { return id; }
  uint64_t  by_branch() const { return braname.value; }
  uint64_t  by_user() const { return username.value; }
  uint128_t by_branch_user() const { return combine_ids(braname.value, username.value); }
};

typedef eosio::multi_index<
    "reserves"_n, branch_reserve,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<branch_reserve, uint64_t, &branch_reserve::by_branch>>,
    eosio::indexed_by<"byuser"_n, eosio::const_mem_fun<branch_reserve, uint64_t, &branch_reserve::by_user>>,
    eosio::indexed_by<"bybruser"_n, eosio::const_mem_fun<branch_reserve, uint128_t, &branch_reserve::by_branch_user>>>
    branch_reserves_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(branch_reserve, cooperative);
