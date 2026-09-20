#pragma once

#include <eosio/eosio.hpp>

#include "operations.hpp"
#include "wallets.hpp"

/**
 * @brief Что происходит с кошельком пайщика при выходе из кооператива.
 *
 * Выход собирает средства пайщика по всем программам и возвращает их одним
 * платежом. Что именно возвращается, определяет эта таблица, а не вид взноса:
 * членский взнос ЦПП «Образование» возвратен, потому что так сказано в её
 * Положении, а членский взнос «Стола заказов» остаётся кооперативу, потому
 * что его Положение возврата не предусматривает.
 *
 * Подключить программу к выходу — добавить сюда строку. Контракт registrator
 * при этом не меняется: `confirmexit` обходит таблицу, `completexit` зовёт
 * закрытие кошельков программ (задача 41E-2).
 *
 * Каждый USER_SHARED-кошелёк реестра обязан иметь строку — сборка падает,
 * если новый пользовательский кошелёк завели, а про выход не подумали.
 */

/// Что делает выход с кошельком пайщика.
enum class ExitWalletPolicy : uint8_t {
  /// Главный паевой кошелёк — на нём собирается вся сумма возврата.
  MAIN = 0,
  /// Возвращается пайщику: остаток переносится на главный паевой указанной операцией.
  RETURN_TO_MAIN = 1,
  /// Остаётся кооперативу; закрывает его сама программа в `settle_program_wallets_on_exit`.
  FORFEIT = 2,
  /// Ненулевой остаток запрещает выход: сначала завершить обязательства.
  BLOCKER = 3,
  /// Выход этот кошелёк не трогает (не средства пайщика либо решение отложено).
  UNTOUCHED = 4,
};

struct ExitWalletRule {
  eosio::name      wallet;
  ExitWalletPolicy policy;
  /// Операция переноса на главный паевой; пусто у всех политик, кроме RETURN_TO_MAIN.
  eosio::name      transfer_op;
  /// Для BLOCKER — причина отказа пайщику; для остальных — пояснение к решению.
  const char*      note;
};

static constexpr ExitWalletRule EXIT_WALLET_POLICY[] = {
  // --- Паевые взносы: возвращаются пайщику --------------------------------
  { ledger2_wallets::SHARE_FUND_PAY, ExitWalletPolicy::MAIN, eosio::name{},
    "Главный паевой взнос — на него собирается возврат" },
  { ledger2_wallets::MIN_SHARE_FUND, ExitWalletPolicy::RETURN_TO_MAIN,
    operations::registrator::MOVE_MINSHARE,
    "Минимальный паевой взнос" },
  { ledger2_wallets::BLAGOROST_FUND, ExitWalletPolicy::RETURN_TO_MAIN,
    operations::capital::WITHDRAW_FROM_CAPITAL,
    "Паевой взнос ЦПП «Благорост»" },
  { ledger2_wallets::MARKETPLACE_SHARE_FUND, ExitWalletPolicy::RETURN_TO_MAIN,
    operations::marketplace::RECALL_SHARE,
    "Свободный паевой взнос ЦПП «Стол заказов»" },

  // --- Членские взносы: возвратность решает Положение программы -----------
  // «Образование»: п. 4.2.5 Положения возвращает взнос участнику на кошелёк
  // программы, а оттуда — на паевой по его заявлению. Заявление об
  // аннулировании соглашений (registry 190) и есть это распоряжение.
  { ledger2_wallets::EDU_MEMBER_FEE, ExitWalletPolicy::RETURN_TO_MAIN,
    operations::edubridge::RETURN_TO_SHARE,
    "Членский взнос ЦПП «Образование» (п. 4.2.5 Положения)" },
  // «Стол заказов»: возврат членского взноса Положением не предусмотрен —
  // остаток уходит в пул взносов и далее в общий кошелёк участка.
  { ledger2_wallets::MARKETPLACE_MEMBER_FUND, ExitWalletPolicy::FORFEIT, eosio::name{},
    "Членский взнос ЦПП «Стол заказов» — Положение возврата не предусматривает" },

  // --- Незавершённые обязательства: держат выход --------------------------
  { ledger2_wallets::MARKETPLACE_ORDER_LOCK, ExitWalletPolicy::BLOCKER, eosio::name{},
    "под заказы Стола заказов зарезервирован паевой взнос — завершите или отмените заказы" },
  { ledger2_wallets::ADVANCE_HOLD, ExitWalletPolicy::BLOCKER, eosio::name{},
    "не закрыт подотчёт по служебной записке — отчитайтесь или верните аванс" },
  // Материалы занятий на ответственном хранении: гарантийный срок идёт, судьба
  // взноса ещё не решена. Выход ждёт окончания срока — иначе кооператив
  // остаётся с принятым имуществом и без стороны договора.
  { ledger2_wallets::EDU_RID_HOLD, ExitWalletPolicy::BLOCKER, eosio::name{},
    "идёт гарантийный срок по переданным материалам занятий — дождитесь его окончания" },

  // --- Выход не трогает ---------------------------------------------------
  // Членская часть Цифрового кошелька: политика не определена (решение
  // владельца отложено), поэтому остаток пайщика выход не трогает.
  { ledger2_wallets::CK_MEMBER, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Членская часть Цифрового кошелька — политика выхода не определена" },
  { ledger2_wallets::PREIMP_FUND, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Пред-импорт РИД — учётный кошелёк, не средства пайщика" },
  { ledger2_wallets::MARKETPLACE_CLAIM_PENDING, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Требование к контрагенту по договору поставки, а не участие пайщика" },
  { ledger2_wallets::MARKETPLACE_SUPPLIER_DEBT, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Задолженность поставщика по договору поставки" },
  { ledger2_wallets::MARKETPLACE_SUPPLIER_PAYABLE, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Обязательство кооператива перед поставщиком" },
  { ledger2_wallets::BRANCH_PERSONAL, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Распределение кооперативного участка — назначает председатель участка" },
  { ledger2_wallets::BRANCH_COMMON, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Общий кошелёк участка: L3-разрез по участку, а не по пайщику" },
  { ledger2_wallets::REGISTRATION_PENDING, ExitWalletPolicy::UNTOUCHED, eosio::name{},
    "Взнос кандидата до вступления — выходить ещё неоткуда" },
};

static constexpr size_t EXIT_WALLET_POLICY_SIZE =
  sizeof(EXIT_WALLET_POLICY) / sizeof(EXIT_WALLET_POLICY[0]);

namespace ledger2_exit_policy_detail {
  constexpr const ExitWalletRule* find_rule(eosio::name wallet) {
    for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
      if (EXIT_WALLET_POLICY[i].wallet == wallet) return &EXIT_WALLET_POLICY[i];
    }
    return nullptr;
  }

  constexpr bool wallets_unique() {
    for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
      for (size_t j = i + 1; j < EXIT_WALLET_POLICY_SIZE; ++j) {
        if (EXIT_WALLET_POLICY[i].wallet == EXIT_WALLET_POLICY[j].wallet) return false;
      }
    }
    return true;
  }

  /// Каждый пользовательский кошелёк реестра назван в таблице — забыть нельзя.
  constexpr bool covers_all_user_wallets() {
    for (size_t i = 0; i < LEDGER2_WALLET_REGISTRY_SIZE; ++i) {
      if (LEDGER2_WALLET_REGISTRY[i].kind != WalletKind::USER_SHARED) continue;
      if (find_rule(LEDGER2_WALLET_REGISTRY[i].name) == nullptr) return false;
    }
    return true;
  }

  /// Кошелёк кооператива в таблице не место: выход собирает средства пайщика.
  constexpr bool only_user_wallets() {
    for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
      bool found = false;
      for (size_t j = 0; j < LEDGER2_WALLET_REGISTRY_SIZE; ++j) {
        if (LEDGER2_WALLET_REGISTRY[j].name != EXIT_WALLET_POLICY[i].wallet) continue;
        found = LEDGER2_WALLET_REGISTRY[j].kind == WalletKind::USER_SHARED;
        break;
      }
      if (!found) return false;
    }
    return true;
  }

  constexpr const OperationRegistryEntry* find_op(eosio::name code) {
    for (size_t i = 0; i < OPERATION_REGISTRY_SIZE; ++i) {
      if (OPERATION_REGISTRY[i].code == code) return &OPERATION_REGISTRY[i];
    }
    return nullptr;
  }

  /// Возврат переносит остаток именно с этого кошелька именно на главный паевой.
  constexpr bool transfers_consistent() {
    for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
      const auto& r = EXIT_WALLET_POLICY[i];
      if (r.policy != ExitWalletPolicy::RETURN_TO_MAIN) {
        if (r.transfer_op != eosio::name{}) return false;
        continue;
      }
      const auto* op = find_op(r.transfer_op);
      if (!op) return false;
      if (op->wallet_op != WalletOp::TRANSFER) return false;
      if (op->wallet_from != r.wallet) return false;
      if (op->wallet_to != ledger2_wallets::SHARE_FUND_PAY) return false;
    }
    return true;
  }

  /// Цель сбора одна — главный паевой.
  constexpr bool single_main() {
    size_t count = 0;
    for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
      if (EXIT_WALLET_POLICY[i].policy == ExitWalletPolicy::MAIN) ++count;
    }
    return count == 1;
  }
} // namespace ledger2_exit_policy_detail

static_assert(ledger2_exit_policy_detail::wallets_unique(),
              "EXIT_WALLET_POLICY: кошелёк назван дважды");
static_assert(ledger2_exit_policy_detail::covers_all_user_wallets(),
              "EXIT_WALLET_POLICY: у пользовательского кошелька нет политики выхода — "
              "добавьте строку в lib/core/ledger2/exit_policy.hpp");
static_assert(ledger2_exit_policy_detail::only_user_wallets(),
              "EXIT_WALLET_POLICY: кошелёк кооператива в таблице выхода не участвует");
static_assert(ledger2_exit_policy_detail::transfers_consistent(),
              "EXIT_WALLET_POLICY: операция возврата не переносит остаток кошелька на главный паевой");
static_assert(ledger2_exit_policy_detail::single_main(),
              "EXIT_WALLET_POLICY: главный паевой кошелёк должен быть ровно один");

/// @brief Правило выхода для кошелька; `nullptr` — кошелёк не пользовательский.
inline const ExitWalletRule* find_exit_wallet_rule(eosio::name wallet) {
  return ledger2_exit_policy_detail::find_rule(wallet);
}
