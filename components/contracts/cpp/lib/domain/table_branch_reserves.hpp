#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
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
 *  - предел материальной помощи получателя за календарный месяц (проверяет
 *    `createaid` по накопителю `aidmonths`);
 *  - слагаемое расходов участка в расчёте итога месяца Стола заказов:
 *    сумма строк участка — резерв Р (читает контракт marketplace).
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
