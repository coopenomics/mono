#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @brief Расход кооперативного участка, поданный в шасси расходов
 * (requirement b6 «Экономика КУ»; процесс p.brn.spend).
 *
 * Участок — инициатор расхода: при подаче служебной записки сумма уходит из
 * общего кошелька участка в пул расходов (o.brn.expfnd), а сама записка
 * дальше живёт в шасси расходов — решение совета, оплата по реквизитам либо
 * аванс под отчёт, отчёт с чеками, закрытие. Эта запись хранит то, чего
 * шасси не знает: какому участку принадлежат выделенные средства и сколько
 * их было выделено.
 *
 * Запись живёт ТОЛЬКО пока расход не завершён (наличие записи = расход в
 * работе). На терминальном переходе шасси вызывает `branch::onexpdone`:
 * неизрасходованный остаток возвращается в общий кошелёк участка
 * (o.brn.expunf), запись стирается из RAM, история — в журнале действий.
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash` —
 * этот hash совпадает с идентификатором служебной записки в шасси расходов.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: expenses
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_expense {
  uint64_t           id;        ///< суррогатный ключ (scope coopname)
  eosio::checksum256 hash;      ///< идентификатор расхода (= proposal_hash в шасси расходов)
  eosio::name        braname;   ///< кооперативный участок — владелец средств
  eosio::name        creator;   ///< кто подал служебную записку
  eosio::asset       amount;    ///< сумма, выделенная под расход в пул расходов

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
  uint64_t by_branch() const { return braname.value; }
};

typedef eosio::multi_index<
    "expenses"_n, branch_expense,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<branch_expense, eosio::checksum256, &branch_expense::by_hash>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<branch_expense, uint64_t, &branch_expense::by_branch>>>
    branch_expenses_index;
