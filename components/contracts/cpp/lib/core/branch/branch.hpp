#pragma once

#include <string>
#include <tuple>

#include <eosio/action.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"

/**
 * Чтение таблиц branch / branchstat (domain/index.hpp — раньше).
 */
namespace Branch {

uint64_t get_branch_count(eosio::name coopname) {
  branchstat_index stat(_branch, _branch.value);
  auto st = stat.find(coopname.value);

  if (st == stat.end()) {
    return 0;
  }

  return st->count;
}

bool is_trustee(eosio::name coopname, eosio::name username) {
  branch_index branches(_branch, coopname.value);

  auto by_trustee_index = branches.get_index<"bytrustee"_n>();
  auto trustee_itr = by_trustee_index.find(username.value);

  return trustee_itr != by_trustee_index.end();
}

bool is_trusted(eosio::name coopname, eosio::name braname, eosio::name username) {
  branch_index branches(_branch, coopname.value);
  auto branch_itr = branches.find(braname.value);

  if (branch_itr == branches.end()) {
    return false;
  }

  return branch_itr->is_account_in_trusted(username);
}

/**
 * @brief Inline-вызов branch::accrue от контракта-источника членских
 * взносов (requirement b6 «Экономика КУ», раунд 5: приоритет общего
 * кошелька): зачисление 100% взноса в общий кошелёк КУ (o.brn.common).
 * Дальнейшее использование — отдельные команды председателя
 * (distribute / createexp) после контроля планового резерва бэкендом.
 */
inline void accrue(eosio::name actor, eosio::name coopname, eosio::name braname,
                   eosio::asset amount,
                   eosio::checksum256 process_hash, std::string memo) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _branch,
    "accrue"_n,
    std::make_tuple(coopname, braname, actor, amount, process_hash, memo)
  ).send();
}

/**
 * @brief Inline-вызов branch::retfee от контракта-источника — точная
 * инверсия accrue: членский взнос возвращается из общего кошелька КУ в пул
 * взносов «Стола заказов» (o.brn.retfee, username = braname).
 *
 * Нужен при гарантийном возврате имущества: пайщику возвращается полная
 * уплаченная сумма, включая членский взнос, а не только стоимость имущества.
 * Вторую ногу (пул → членский кошелёк заказчика) делает контракт-источник
 * своей операцией возврата взноса — прямой перевод между кошельком КУ и
 * кошельком пайщика невозможен (walletop держит один username на обе стороны).
 *
 * Средства должны физически быть в общем кошельке КУ: если участок уже
 * распределил или потратил их, вызов падает с человекочитаемым текстом —
 * председатель сначала пополняет общий кошелёк.
 */
inline void retfee(eosio::name actor, eosio::name coopname, eosio::name braname,
                   eosio::asset amount,
                   eosio::checksum256 process_hash, std::string memo) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _branch,
    "retfee"_n,
    std::make_tuple(coopname, braname, actor, amount, process_hash, memo)
  ).send();
}

} // namespace Branch
