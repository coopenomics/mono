#pragma once

#include <eosio/eosio.hpp>
#include <string_view>
#include <array>

#include "../../consts.hpp"
#include "../ledger2/wallets.hpp"
#include "../ledger2/operations.hpp"

/**
 * @file collateral.hpp
 * @brief Реестр обеспечения беспроцентных займов.
 *
 * Запись реестра говорит, средства какого кошелька пайщика принимаются в
 * обеспечение займа, куда они переводятся на время займа, какими операциями
 * ledger2 обеспечение блокируется, возвращается и обращается в пользу
 * кооператива, и на основании какого договора пайщик берёт заём. Новый вид
 * обеспечения кошельком — новая строка здесь, код контракта не меняется.
 *
 * Реестр экспортируется в cooptypes генератором `gen-from-cpp.ts`
 * (`DEBT_COLLATERAL_REGISTRY`): интерфейс и контроллер читают его оттуда и
 * свой список не ведут.
 */
namespace Debt {

/// Тип основания договора займа: по какому документу пайщик состоит в программе.
enum class BasisType : uint8_t {
  UHD   = 0, ///< договор об участии в хозяйственной деятельности (приложение к нему)
  OFFER = 1, ///< оферта целевой программы
};

struct CollateralEntry {
  eosio::name      key;             ///< ключ обеспечения, передаётся в `createloan`
  eosio::name      source_wallet;   ///< кошелёк пайщика, с которого берётся обеспечение
  eosio::name      pledge_wallet;   ///< кошелёк обеспечения на время займа
  eosio::name      pledge_op;       ///< операция блокировки (source → pledge, без проводки)
  eosio::name      unpledge_op;     ///< операция возврата обеспечения (pledge → source, без проводки)
  eosio::name      seize_op;        ///< операция обращения обеспечения в пользу кооператива
  eosio::name      owner_contract;  ///< контракт программы-источника; пусто — без согласования
  eosio::name      sync_action;     ///< действие владельца перед движением обеспечения (проверка договора, пересчёт начислений)
  BasisType        basis_type;      ///< тип основания договора займа
  uint64_t         basis_registry_id; ///< номер шаблона документа-основания в реестре документов
  std::string_view human_name;      ///< наименование обеспечения для текста заявления и договора
};

inline constexpr std::array<CollateralEntry, 1> DEBT_COLLATERAL_REGISTRY = {{
  { "blago"_n, ledger2_wallets::BLAGOROST_FUND, ledger2_wallets::LOAN_PLEDGE,
    operations::capital::PLEDGE, operations::capital::UNPLEDGE, operations::capital::SEIZE,
    _capital, "pledgesync"_n, BasisType::UHD, 1001,
    "имущественное право на возврат части паевого взноса по целевой потребительской программе «Благорост»" },
}};

inline const CollateralEntry* find_collateral(eosio::name key) {
  for (const auto& c : DEBT_COLLATERAL_REGISTRY) {
    if (c.key == key) return &c;
  }
  return nullptr;
}

inline const CollateralEntry& get_collateral_or_fail(eosio::name key) {
  const auto* c = find_collateral(key);
  eosio::check(c != nullptr, "Такое обеспечение займа не предусмотрено");
  return *c;
}

} // namespace Debt
