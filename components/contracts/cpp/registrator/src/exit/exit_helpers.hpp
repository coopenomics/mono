#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../../../lib/index.hpp"

/**
 * @brief Вспомогательные функции процедуры выхода пайщика из кооператива.
 *
 * Вынесены в отдельный заголовок (а не в table_registrator_exits.hpp), т.к.
 * опираются на ledger2-кошельки и userwallets, которые подключаются позже в
 * domain/index.hpp. Подключается в registrator.cpp перед exit-экшенами, когда
 * весь lib/index.hpp уже доступен.
 */
namespace Registrator {

using namespace eosio;

/**
 * @brief Перенос остатка кошелька пайщика на главный паевой перед резервом
 * возврата при выходе.
 *
 * Какой операцией переносить, говорит таблица `EXIT_WALLET_POLICY`
 * (lib/core/ledger2/exit_policy.hpp). Главный паевой уже целевой — его
 * переносить некуда. Кошелёк без строки возврата сюда не попадает: обход в
 * `confirmexit` берёт из таблицы только те, что возвращаются пайщику.
 */
inline void consolidate_share_to_main(name coopname, name username, const ExitWalletRule& rule, asset amount, checksum256 exit_hash) {
  if (rule.policy == ExitWalletPolicy::MAIN) return; // уже на главном паевом

  eosio::check(rule.policy == ExitWalletPolicy::RETURN_TO_MAIN,
    std::string{"Кошелёк "} + rule.wallet.to_string() + " не возвращается пайщику при выходе");

  // Нитку называет её инициатор — выход из кооператива, поэтому имя одно на
  // все консолидируемые кошельки. Иначе у одного exit_hash оказалось бы два
  // имени (p.wal.wthdrw и p.cap.wthcap), и какое победит, зависело бы от того,
  // на каком кошельке у пайщика ненулевой остаток. Операция возврата из
  // «Благороста» при этом остаётся собственной операцией — в чужой нитке она
  // идёт по тому же правилу, что членский взнос КУ внутри поставки.
  std::string memo = "Консолидация средств при выходе, кошелёк=" +
                     rule.wallet.to_string() + ", username=" + username.to_string();
  Ledger2::apply(_registrator, coopname, rule.transfer_op, processes::wallet::WITHDRAW,
                 amount, username, exit_hash, memo);
}

// Проверки программ перед выходом и закрытие их членских кошельков при
// состоявшемся выходе — в shared-слое (lib/core/registrator/exit.hpp): код
// контракта чужих таблиц не читает (задача 99D-16).

/**
 * @brief Финализация выхода: аннулирование соглашений ЦПП, удаление пайщика из
 * реестра совета и блокировка аккаунта в registrator.
 *
 * Вызывается по завершении возврата паевого взноса (completexit) либо сразу,
 * если возвращать нечего (нулевой паевой). Аннулирует соглашения пайщика об
 * участии в программах, удаляет его из реестра совета и блокирует аккаунт.
 * После этого `get_participant_or_fail` для пайщика начинает падать — он лишён
 * права подавать заявления.
 */
inline void finalize_member_exit(name coopname, name username) {
  // Выход состоялся — участие в целевых потребительских программах
  // прекращается: соглашения аннулируются по заявлению пайщика (registry 190).
  Core::Registrator::revoke_program_agreements(_registrator, coopname, username);

  // удаляем пайщика из реестра совета (уменьшит счётчик активных пайщиков)
  action(
    permission_level{_registrator, "active"_n},
    _soviet,
    "delpartcpnt"_n,
    std::make_tuple(coopname, username)
  ).send();

  // блокируем аккаунт в картотеке registrator
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");
  accounts.modify(account, RamPayer::of(accounts, coopname), [&](auto &a) {
    a.status = "blocked"_n;
  });
}

} // namespace Registrator
