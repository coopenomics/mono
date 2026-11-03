#pragma once

#include <string>
#include <string_view>
#include <tuple>

#include <eosio/action.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"
#include "../../domain/table_fund_funds.hpp"
#include "../ledger2/operations.hpp"
#include "../ledger2/wallets.hpp"

/**
 * Фонды кооператива: пять стандартных фондов на кошельках ledger2 (задачи
 * 99D-19 и 99D-25; решения владельца 02–03.11.2026).
 *
 * Кошелёк и есть субсчёт фонда: остатки и движения живут только в ledger2 на
 * счёте 86. Контракт `fund` хранит настройки (название, описание, процент
 * отчислений, кошелёк) в таблице `funds`. Контракт-источник членских взносов
 * (сегодня — marketplace при списании обеспечительной части) зовёт
 * `fund::accrue` инлайн, деление по процентам делает контракт fund.
 */
namespace Fund {

/// Идентификаторы стандартных фондов — постоянные у всех кооперативов.
inline constexpr uint64_t INDIVISIBLE_ID = 1;  ///< Неделимый фонд (накопления)
inline constexpr uint64_t RESERVE_ID     = 2;  ///< Резервный фонд (накопления)
inline constexpr uint64_t DEVELOPMENT_ID = 3;  ///< Фонд развития кооперации (накопления)
inline constexpr uint64_t ECONOMIC_ID    = 4;  ///< Фонд обеспечения хозяйственной деятельности (списания)
inline constexpr uint64_t MUTUAL_ID      = 5;  ///< Фонд взаимного обеспечения (списания)

inline constexpr eosio::name KIND_ACCUMULATION = "accum"_n;   ///< Фонд накопления: процент отчислений, остаток растёт
inline constexpr eosio::name KIND_EXPENDITURE  = "expend"_n;  ///< Фонд списания: выплаты проходят через него транзитом

/// Описание стандартного фонда: как заводится при старте кооператива.
struct StandardFund {
  uint64_t          id;
  eosio::name       kind;
  std::string_view  name;
  eosio::name       wallet;
  uint64_t          percent;     ///< ×10 000; у фондов списания 0
  eosio::name       accrue_op;   ///< Операция отчисления; у фондов списания пустое имя
};

/// Пять стандартных фондов по Положению о фондах; проценты по умолчанию 1 / 15 / 5.
inline constexpr StandardFund STANDARD_FUNDS[] = {
  { INDIVISIBLE_ID, KIND_ACCUMULATION, "Неделимый фонд",                                ledger2_wallets::FUND_INDIVISIBLE,  1 * ONE_PERCENT, operations::fund::ACCRUE_INDIVISIBLE },
  { RESERVE_ID,     KIND_ACCUMULATION, "Резервный фонд",                                ledger2_wallets::FUND_RESERVE,     15 * ONE_PERCENT, operations::fund::ACCRUE_RESERVE },
  { DEVELOPMENT_ID, KIND_ACCUMULATION, "Фонд развития кооперации",                      ledger2_wallets::FUND_DEVELOPMENT,  5 * ONE_PERCENT, operations::fund::ACCRUE_DEVELOPMENT },
  { ECONOMIC_ID,    KIND_EXPENDITURE,  "Фонд обеспечения хозяйственной деятельности",   ledger2_wallets::SOV_EXPENSES,      0,               eosio::name{} },
  { MUTUAL_ID,      KIND_EXPENDITURE,  "Фонд взаимного обеспечения",                    ledger2_wallets::FUND_MUTUAL,       0,               eosio::name{} },
};
inline constexpr size_t STANDARD_FUNDS_SIZE = sizeof(STANDARD_FUNDS) / sizeof(STANDARD_FUNDS[0]);

/// Описание стандартного фонда по идентификатору; nullptr — такого фонда нет.
inline constexpr const StandardFund* standard_fund(uint64_t id) {
  for (const auto& f : STANDARD_FUNDS) if (f.id == id) return &f;
  return nullptr;
}

/**
 * @brief Сумма процентов фондов накопления кооператива (×10 000).
 *
 * Читает `funds` контракта fund — единственная точка чтения этой таблицы для
 * других контрактов (правило «чужие таблицы — через shared lib/core»). Нет строк —
 * ноль: отчислений не будет, а контракт-источник сам решает, что с этим делать.
 */
inline uint64_t accumulation_percent_sum(eosio::name coopname) {
  funds_index funds(_fund, coopname.value);
  uint64_t total = 0;
  for (auto it = funds.begin(); it != funds.end(); ++it) {
    if (it->kind == KIND_ACCUMULATION) total += it->percent;
  }
  return total;
}

/**
 * @brief Inline-вызов `fund::accrue` от контракта-источника членских взносов:
 * сумма делится между фондами накопления по их процентам и зачисляется на
 * кошелёк каждого фонда (o.fnd.indiv / o.fnd.resrv / o.fnd.devel, Дт 80 / Кт 86)
 * в нитке процесса источника. Образец — `Branch::accrue`.
 */
inline void accrue(eosio::name actor, eosio::name coopname, eosio::asset amount,
                   eosio::name process_type, eosio::checksum256 process_hash,
                   std::string memo) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _fund,
    "accrue"_n,
    std::make_tuple(coopname, actor, amount, process_type, process_hash, memo)
  ).send();
}

} // namespace Fund
