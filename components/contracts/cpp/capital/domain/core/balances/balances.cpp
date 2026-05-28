#include "balances.hpp"

using namespace eosio;
using std::string;

namespace Capital::Core {

  /**
   * @brief Совокупный баланс программы Благорост на уровне кооператива.
   *
   * Источник — ledger2 L2 (`wallets[BLAGOROST_FUND]`), агрегированный по всем
   * пайщикам. Σ L3.available[w.cap.blago] == L2.available (Эпик 3 invariant),
   * поэтому L2 — авторитетная сумма для CRPS-знаменателя. Если кошелёк ещё не
   * создан (никто не инвестировал) — нулевой баланс.
   *
   * Поле blocked упразднено (2026-05-24): субсчёт «заблокировано» больше не
   * используется, баланс кошелька = available.
   */
  eosio::asset get_capital_program_share_balance(eosio::name coopname) {
    wallets2_index wallets(_ledger2, coopname.value);
    auto it = wallets.find(ledger2_wallets::BLAGOROST_FUND.value);
    if (it == wallets.end()) return eosio::asset(0, _root_govern_symbol);
    return it->available;
  }

  /**
   * @brief Доля пайщика в Благоросте (available) из ledger2 L3.
   *
   * Источник — `userwallets[(w.cap.blago, username)]`. Запись существует
   * только пока available > 0 (Эпик 3 §6: auto-delete на нуле), поэтому
   * отсутствие = нулевой баланс. Поле blocked упразднено (2026-05-24).
   */
  eosio::asset get_capital_program_user_share_balance(eosio::name coopname, eosio::name username) {
    userwallets_index user_wallets(_ledger2, coopname.value);
    auto idx = user_wallets.get_index<"byuserwallet"_n>();
    auto key = combine_ids(ledger2_wallets::BLAGOROST_FUND.value, username.value);
    auto it = idx.find(key);
    if (it == idx.end()) return eosio::asset(0, _root_govern_symbol);
    return it->available;
  }
}