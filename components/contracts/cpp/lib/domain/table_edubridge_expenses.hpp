#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"

/**
 * @brief Расход ЦПП «Образование», поданный в шасси расходов
 * (процесс p.edu.spend).
 *
 * Программа — инициатор расхода: при подаче служебной записки сумма уходит
 * из фонда программы в пул расходов (o.edu.expfnd), а сама записка дальше
 * живёт в шасси — решение совета, оплата по реквизитам либо аванс под отчёт,
 * отчёт с чеками, закрытие. Эта запись хранит то, чего шасси не знает:
 * сколько средств программы выделено под расход и кто его подал.
 *
 * Запись живёт, пока расход не завершён. На терминальном переходе шасси
 * вызывает `edubridge::onexpdone`: неизрасходованный остаток возвращается в
 * фонд программы (o.edu.expunf), запись стирается из RAM, история — в
 * журнале действий.
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash` —
 * этот hash совпадает с идентификатором служебной записки в шасси расходов.
 *
 * @ingroup public_tables
 * @ingroup public_edubridge_tables
 * @par table: expenses
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_expense {
  uint64_t           id;       ///< суррогатный ключ (scope coopname)
  eosio::checksum256 hash;     ///< идентификатор расхода (= proposal_hash в шасси расходов)
  eosio::name        creator;  ///< кто подал служебную записку
  eosio::asset       amount;   ///< сумма, выделенная под расход в пул расходов

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
};

typedef eosio::multi_index<
    "expenses"_n, edu_expense,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<edu_expense, eosio::checksum256, &edu_expense::by_hash>>>
    edu_expenses_index;
