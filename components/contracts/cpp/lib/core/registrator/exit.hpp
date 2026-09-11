#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

/**
 * Выход пайщика из кооператива и программы (shared-слой, задача 99D-16).
 * Контракт registrator зовёт эти методы и чужих таблиц не знает; какие
 * программы проверяются и что с их кошельками происходит при выходе, знает
 * только этот файл. Подключается из core/index.hpp после заголовков программ.
 */
namespace Core::Registrator {

/// Выход возможен: ни одна программа не держит незавершённого.
inline void check_member_can_exit(eosio::name coopname, eosio::name username) {
  Marketplace::check_member_can_exit(coopname, username);
}

/// Выход состоялся: программы закрывают членские кошельки пайщика. `actor` —
/// контракт, проводящий выход.
inline void settle_program_wallets_on_exit(eosio::name actor, eosio::name coopname,
                                           eosio::name username, const eosio::checksum256& exit_hash) {
  Marketplace::settle_member_fund_on_exit(actor, coopname, username, exit_hash);
}

} // namespace Core::Registrator
