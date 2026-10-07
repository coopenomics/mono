#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>
#include <vector>

#include "../lib/index.hpp"

/**
 * @file domain.hpp
 * @brief Внутренняя логика контракта `debt`: работа с записью займа, сводкой
 * долга пайщика и обеспечением. Таблицы и реестр обеспечения — в общей
 * библиотеке (`lib/domain/table_debt_*.hpp`, `lib/core/debt/`).
 */
namespace Debt::Core {

  /// Срок на расчёт после просрочки до обращения обеспечения — пять дней по договору.
  constexpr uint32_t GRACE_SECONDS = 5 * 24 * 60 * 60;
  /// Не больше стольких займов обрабатывает один вызов сверки сроков.
  constexpr uint32_t SWEEP_MAX = 25;

  inline eosio::time_point_sec now() {
    return eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  }

  inline debt get_debt_or_fail(eosio::name coopname, const eosio::checksum256& debt_hash) {
    auto d = Debt::get_debt(coopname, debt_hash);
    eosio::check(d.has_value(), "Заём не найден");
    return d.value();
  }

  template <typename F>
  inline void modify_debt(eosio::name coopname, uint64_t id, F&& f) {
    debts_index debts(_debt, coopname.value);
    auto it = debts.find(id);
    eosio::check(it != debts.end(), "Заём не найден");
    debts.modify(it, RamPayer::of(debts, coopname), std::forward<F>(f));
  }

  inline void erase_debt(eosio::name coopname, uint64_t id) {
    debts_index debts(_debt, coopname.value);
    auto it = debts.find(id);
    eosio::check(it != debts.end(), "Заём не найден");
    debts.erase(it);
  }

  /// Общий долг пайщика: прибавить при выдаче, убавить при возврате и закрытии. Нулевая сводка удаляется.
  inline void change_summary(eosio::name coopname, eosio::name username, const eosio::asset& delta) {
    summaries_index summaries(_debt, coopname.value);
    auto it = summaries.find(username.value);
    if (it == summaries.end()) {
      eosio::check(delta.amount >= 0, "Сводка долга пайщика не найдена");
      if (delta.amount == 0) return;
      summaries.emplace(RamPayer::of(summaries), [&](auto& s) {
        s.username = username;
        s.total = delta;
      });
      return;
    }
    eosio::asset total = it->total + delta;
    eosio::check(total.amount >= 0, "Сводка долга пайщика ушла бы в минус");
    if (total.amount == 0) {
      summaries.erase(it);
    } else {
      summaries.modify(it, RamPayer::of(summaries), [&](auto& s) { s.total = total; });
    }
  }

  /// Программа-владелец обеспечения согласует движение: проверяет договор пайщика и пересчитывает начисления.
  inline void sync_collateral_owner(const CollateralEntry& c, eosio::name coopname, eosio::name username) {
    if (c.owner_contract.value == 0 || c.sync_action.value == 0) return;
    eosio::action(eosio::permission_level{_debt, "active"_n}, c.owner_contract, c.sync_action,
                  std::make_tuple(coopname, username)).send();
  }

  inline void pledge(const CollateralEntry& c, eosio::name coopname, eosio::name username,
                     const eosio::asset& amount, const eosio::checksum256& debt_hash) {
    sync_collateral_owner(c, coopname, username);
    Ledger2::apply(_debt, coopname, c.pledge_op, processes::debt::LOAN, amount, username, debt_hash,
                   Memo::get_pledge_memo(debt_hash));
  }

  inline void unpledge(const CollateralEntry& c, eosio::name coopname, eosio::name username,
                       const eosio::asset& amount, const eosio::checksum256& debt_hash) {
    if (amount.amount <= 0) return;
    sync_collateral_owner(c, coopname, username);
    Ledger2::apply(_debt, coopname, c.unpledge_op, processes::debt::LOAN, amount, username, debt_hash,
                   Memo::get_unpledge_memo(debt_hash));
  }

  inline void seize(const CollateralEntry& c, eosio::name coopname, eosio::name username,
                    const eosio::asset& amount, const eosio::checksum256& debt_hash) {
    if (amount.amount <= 0) return;
    sync_collateral_owner(c, coopname, username);
    Ledger2::apply(_debt, coopname, c.seize_op, processes::debt::LOAN, amount, username, debt_hash,
                   Memo::get_seize_memo(debt_hash));
  }

  /// Платёж кассиру: по подтверждению заём считается выданным, по отказу — ждёт повтора.
  inline void send_payout(eosio::name coopname, const debt& d) {
    ::Gateway::create_outcome(_debt, coopname, d.username, d.debt_hash, d.amount, _debt,
                              Names::Debt::ON_PAID, Names::Debt::ON_PAY_DECLINE);
  }

  /// Заём ещё не выдан: обеспечение возвращается в программу, начисление к выдаче снимается, запись удаляется.
  inline void abandon_before_issue(eosio::name coopname, const debt& d) {
    const auto& c = Debt::get_collateral_or_fail(d.collateral);
    if (d.status == Status::SIGNED) {
      Ledger2::apply(_debt, coopname, operations::debt::CANCEL, processes::debt::LOAN, d.amount, d.username,
                     d.debt_hash, Memo::get_cancel_memo(d.debt_hash));
    }
    unpledge(c, coopname, d.username, d.pledged, d.debt_hash);
    erase_debt(coopname, d.id);
  }

} // namespace Debt::Core
