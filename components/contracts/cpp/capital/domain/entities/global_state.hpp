#pragma once

#include <eosio/binary_extension.hpp>

using namespace eosio;
using std::string;

namespace Capital {

  /**
   * @brief Конфигурация контракта, управляемая пользователем.
   */
  struct config {
    double coordinator_bonus_percent = 4;   ///< Процент премий координатора от инвестиций (по умолчанию 4%)
    double expense_pool_percent = 100;         ///< Процент инвестиций в пул расходов (по умолчанию 1.0)
    uint32_t coordinator_invite_validity_days = 30; ///< Срок действия приглашения координатора (по умолчанию 30 дней)
    uint32_t voting_period_in_days = 7;        ///< Период голосования в днях (по умолчанию 7)
    double authors_voting_percent = 38.2;      ///< Процент премий авторов для голосования (по умолчанию)
    double creators_voting_percent = 38.2;     ///< Процент премий создателей для голосования (по умолчанию)
    
    // Параметры геймификации
    double energy_decay_rate_per_day = 1.11;  ///< Скорость уменьшения энергии в день (по умолчанию 1.11% для снижения за 90 дней)
    uint64_t level_depth_base = 10000000000;   ///< Базовая сумма вкладов для уровня 1 (по умолчанию 10000 RUB = 10000000000 микротокенов)
    double level_growth_coefficient = 1.5;     ///< Коэффициент роста требований для следующих уровней (по умолчанию 1.5)
    double energy_gain_coefficient = 1.0;      ///< Множитель скорости набора уровней (по умолчанию 1.0 — вклад размером level_depth_base даёт ровно один уровень)
  };

  /**
   * @brief Таблица глобального состояния хранит общие данные контракта благороста.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): _capital
   * @par Имя таблицы (table): state 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] global_state {
    eosio::name coopname;                                ///< Имя кооператива
    asset global_available_invest_pool = asset(0, _root_govern_symbol); ///< Глобальный пул доступных для аллокации инвестиций в программу
    asset program_membership_funded = asset(0, _root_govern_symbol); ///< Общая сумма членских взносов по программе
    asset program_membership_available = asset(0, _root_govern_symbol); ///< Доступная сумма членских взносов по программе
    asset program_membership_distributed = asset(0, _root_govern_symbol); ///< Распределенная сумма членских взносов по программе
    double program_membership_cumulative_reward_per_share;               ///< Накопительное вознаграждение на долю в членских взносах

    config config;                                           ///< Управляемая конфигурация контракта

    // ВНИМАНИЕ: поля программных расходов добавлены ПОСЛЕ config и обёрнуты в
    // binary_extension. Поля в таблицу EOSIO можно дописывать только в ХВОСТ
    // struct и только через binary_extension — иначе ломается десериализация
    // уже записанного global_state. Инцидент 2026-06-16: эти поля были вставлены
    // перед config напрямую (без extension) и задеплоены на прод — таблица state
    // перестала читаться (get table → "Invalid symbol", action'ы падали на unpack).
    // Инвариант: оба поля материализуются вместе (всегда оба has_value или оба
    // пустые), чтобы порядок хвостовых extension оставался консистентным.
    eosio::binary_extension<asset> program_expense_pool;     ///< Доступная сумма программы под целевые расходы (без аллокации в проекты)
    eosio::binary_extension<asset> program_expense_reserved; ///< Сумма, зарезервированная под approved/authorized программные расходы

    uint64_t primary_key() const { return coopname.value; }     ///< Первичный ключ (1)
  };

  typedef eosio::multi_index<"state"_n, global_state> global_state_table; ///< Таблица для хранения глобального состояния.

  
  

namespace State {

/**
  * @brief Значение binary_extension<asset> или ноль с символом @p sym.
  *
  * Поле ещё не материализовано (старая запись до program_expense_*) → ноль с @p sym.
  * Битая запись: материализованный asset с пустым/чужим символом и amount==0
  * (типичный след default-constructed asset() после инцидента 2026-06-16) → тоже ноль с @p sym.
  * Ненулевая сумма с чужим символом — ошибка данных, не маскируем.
  */
inline asset ext_or_zero(const eosio::binary_extension<asset>& v, const eosio::symbol& sym) {
  if (!v.has_value()) {
    return asset(0, sym);
  }
  const asset &a = v.value();
  if (a.symbol == sym) {
    return a;
  }
  eosio::check(a.amount == 0,
               "program_expense_* содержит ненулевую сумму с несовместимым символом");
  return asset(0, sym);
}

/**
  * @brief Обновляет глобальное состояние новыми значениями.
  *
  * Полное присваивание `s = gs` сохраняет битые program_expense_* (asset с пустым
  * символом). Нормализуем их через ext_or_zero, чтобы последующие invest/topup
  * сами лечили хвост binary_extension.
  */
inline void update_global_state(const global_state& gs){
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(gs.coopname.value);
  check(itr != global_state_inst.end(), "Глобальное состояние не найдено");
  const asset pool     = ext_or_zero(gs.program_expense_pool, _root_govern_symbol);
  const asset reserved = ext_or_zero(gs.program_expense_reserved, _root_govern_symbol);
  global_state_inst.modify(itr, _capital, [&](auto& s) {
      s = gs;
      s.program_expense_pool     = pool;
      s.program_expense_reserved = reserved;
  });
}
    
/**
  * @brief Получает текущее глобальное состояние.
  *
  * @return Текущее глобальное состояние.
  */
inline global_state get_global_state(name coopname) {
    global_state_table global_state_inst(_capital, _capital.value);
    auto itr = global_state_inst.find(coopname.value);
    eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
    return global_state(*itr);
}

/**
 * @brief Проверяет что контракт инициализирован.
 *
 * @param coopname Имя кооператива.
 */
inline void is_initialized(name coopname) {
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(coopname.value);
  eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
}

/**
 * @brief Пополняет пул программных расходов на @p amount из общего пула инвестиций программы.
 *        Вызывается из action topupprogexp (председатель).
 */
inline void topup_program_expense_pool(eosio::name coopname, const asset &amount) {
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(coopname.value);
  eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
  eosio::check(amount.is_valid() && amount.amount > 0, "Сумма пополнения должна быть положительной");
  eosio::check(amount.symbol == _root_govern_symbol, "Символ суммы пополнения должен совпадать с символом программы");
  eosio::check(itr->global_available_invest_pool >= amount,
               "Недостаточно свободных инвестиций программы для пополнения пула расходов");

  global_state_inst.modify(itr, _capital, [&](auto &s) {
    asset pool     = ext_or_zero(s.program_expense_pool, amount.symbol);
    asset reserved = ext_or_zero(s.program_expense_reserved, amount.symbol);
    s.global_available_invest_pool -= amount;
    pool += amount;
    s.program_expense_pool     = pool;
    s.program_expense_reserved = reserved;
  });
}

/**
 * @brief Резервирует средства под approved/authorized программный расход:
 *        program_expense_pool -= amount, program_expense_reserved += amount.
 */
inline void reserve_program_expense(eosio::name coopname, const asset &amount) {
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(coopname.value);
  eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
  eosio::check(amount.is_valid() && amount.amount > 0, "Сумма резерва должна быть положительной");
  eosio::check(ext_or_zero(itr->program_expense_pool, amount.symbol) >= amount,
               "Недостаточно средств в пуле программных расходов");

  global_state_inst.modify(itr, _capital, [&](auto &s) {
    asset pool     = ext_or_zero(s.program_expense_pool, amount.symbol);
    asset reserved = ext_or_zero(s.program_expense_reserved, amount.symbol);
    pool     -= amount;
    reserved += amount;
    s.program_expense_pool     = pool;
    s.program_expense_reserved = reserved;
  });
}

/**
 * @brief Освобождает зарезервированное при отклонении программного расхода:
 *        program_expense_reserved -= amount, program_expense_pool += amount.
 */
inline void release_program_expense(eosio::name coopname, const asset &amount) {
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(coopname.value);
  eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
  eosio::check(amount.is_valid() && amount.amount > 0, "Сумма освобождения должна быть положительной");
  eosio::check(ext_or_zero(itr->program_expense_reserved, amount.symbol) >= amount,
               "Зарезервированных программных расходов меньше указанной суммы");

  global_state_inst.modify(itr, _capital, [&](auto &s) {
    asset pool     = ext_or_zero(s.program_expense_pool, amount.symbol);
    asset reserved = ext_or_zero(s.program_expense_reserved, amount.symbol);
    reserved -= amount;
    pool     += amount;
    s.program_expense_pool     = pool;
    s.program_expense_reserved = reserved;
  });
}

/**
 * @brief Окончательное списание программного расхода (callback onpgexpdone, CLOSED):
 *        program_expense_reserved -= amount. Деньги уже ушли через шасси expense,
 *        ledger2-проводки сделаны на payexp/reportexp/returnexp.
 */
inline void consume_program_expense(eosio::name coopname, const asset &amount) {
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(coopname.value);
  eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
  eosio::check(amount.is_valid() && amount.amount > 0, "Сумма списания должна быть положительной");
  eosio::check(ext_or_zero(itr->program_expense_reserved, amount.symbol) >= amount,
               "Зарезервированных программных расходов меньше указанной суммы");

  global_state_inst.modify(itr, _capital, [&](auto &s) {
    asset pool     = ext_or_zero(s.program_expense_pool, amount.symbol);
    asset reserved = ext_or_zero(s.program_expense_reserved, amount.symbol);
    reserved -= amount;
    s.program_expense_pool     = pool;
    s.program_expense_reserved = reserved;
  });
}

/**
 * @brief Прямое списание из свободного пула программных расходов — превышение
 *        факта над резервом при закрытии расхода с перерасходом (overspendexp
 *        в шасси выдал доплату из BLAGOROST_FUND сверх зарезервированного).
 */
inline void spend_program_expense_pool(eosio::name coopname, const asset &amount) {
  global_state_table global_state_inst(_capital, _capital.value);
  auto itr = global_state_inst.find(coopname.value);
  eosio::check(itr != global_state_inst.end(), "Контракт не инициализирован");
  eosio::check(amount.is_valid() && amount.amount > 0, "Сумма списания должна быть положительной");
  eosio::check(ext_or_zero(itr->program_expense_pool, amount.symbol) >= amount,
               "Недостаточно средств в пуле программных расходов для покрытия перерасхода — пополните пул (topupprogexp)");

  global_state_inst.modify(itr, _capital, [&](auto &s) {
    asset pool     = ext_or_zero(s.program_expense_pool, amount.symbol);
    asset reserved = ext_or_zero(s.program_expense_reserved, amount.symbol);
    pool -= amount;
    s.program_expense_pool     = pool;
    s.program_expense_reserved = reserved;
  });
}
}// namespace State

}// namespace Capital