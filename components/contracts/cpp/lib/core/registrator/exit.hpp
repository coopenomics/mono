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

/// Есть ли у пайщика действующие соглашения об участии в программах: от этого
/// зависит, требуется ли при выходе заявление об аннулировании (registry 190).
inline bool has_program_agreements(eosio::name coopname, eosio::name username) {
  WalletTables::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);
  return user_it != users.end() && !user_it->programs.empty();
}

/// Аннулирование соглашений пайщика об участии в программах — состоявшийся
/// выход прекращает участие во всех ЦПП, даже когда на кошельках программы
/// пусто (решение владельца 20.09.2026). Зовётся в финале выхода: при отказе
/// совета или платежа пайщик остаётся членом, и соглашения продолжают
/// действовать.
inline void revoke_program_agreements(eosio::name actor, eosio::name coopname, eosio::name username) {
  WalletTables::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);
  if (user_it == users.end()) return;

  // Копируем список: revokeagree правит эту же запись, и обход по живой
  // ссылке после первого же вызова смотрел бы на изменённые данные.
  std::vector<uint64_t> program_ids;
  program_ids.reserve(user_it->programs.size());
  for (const auto &p : user_it->programs) program_ids.push_back(p.program_id);

  for (const auto program_id : program_ids) {
    eosio::action(
      eosio::permission_level{actor, "active"_n},
      _wallet,
      "revokeagree"_n,
      std::make_tuple(coopname, username, program_id)
    ).send();
  }
}

/// Выход возможен: ни один кошелёк не держит незавершённого обязательства и
/// ни одна программа не ждёт своего. Кошельки, ненулевой остаток которых
/// держит выход, перечислены в таблице EXIT_WALLET_POLICY — там же и причина,
/// которую увидит пайщик.
inline void check_member_can_exit(eosio::name coopname, eosio::name username) {
  for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
    const auto& rule = EXIT_WALLET_POLICY[i];
    if (rule.policy != ExitWalletPolicy::BLOCKER) continue;
    const eosio::asset balance = Ledger2::get_user_available(coopname, rule.wallet, username);
    eosio::check(balance.amount == 0,
                 std::string{"Выход из кооператива невозможен: "} + rule.note +
                   " (" + balance.to_string() + ")");
  }

  Marketplace::check_member_can_exit(coopname, username);
}

/// Выход состоялся: программы закрывают членские кошельки пайщика. `actor` —
/// контракт, проводящий выход.
inline void settle_program_wallets_on_exit(eosio::name actor, eosio::name coopname,
                                           eosio::name username, const eosio::checksum256& exit_hash) {
  Marketplace::settle_member_fund_on_exit(actor, coopname, username, exit_hash);
}

} // namespace Core::Registrator
