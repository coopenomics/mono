#pragma once

using namespace eosio;
using std::string;

namespace Capital {
  /**
   * @brief Таблица программных инвестиций (progrinvests): ранее использовалась
   *        для заявок на зачёт с этапом одобрения советом. При текущей логике
   *        @ref capital::createpinv строки не создаёт, таблица сохранена для
   *        совместимости и чтения исторических записей.
   *
   * @deprecated Запланировано к удалению после 2026-07. Не использовать в новом
   *             коде. Чтение через scope coopname допустимо до этой даты для
   *             ретроспективных отчётов; писать через emplace/modify нельзя.
   *
   * @ingroup public_tables
   * @ingroup public_capital_tables
   *
   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): progrinvests
   */
  struct [[deprecated("remove after 2026-07"), eosio::table, eosio::contract(CAPITAL)]] program_invest {
    uint64_t id;                                ///< ID программной инвестиции (внутренний ключ)
    eosio::name coopname;                       ///< Имя кооператива
    eosio::name username;                       ///< Имя инвестора
    checksum256 invest_hash;                    ///< Хэш инвестиции
    eosio::name status;                         ///< Статус инвестиции
    time_point_sec invested_at;                 ///< Время создания инвестиции
    document2 statement;                        ///< Заявление на инвестицию
    eosio::asset amount;                        ///< Сумма инвестиции
    
    uint64_t primary_key() const { return id; } ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_hash() const { return invest_hash; } ///< Индекс по хэшу инвестиции (3)
  };

typedef eosio::multi_index<
    "progrinvests"_n, program_invest,
    indexed_by<"byusername"_n, const_mem_fun<program_invest, uint64_t, &program_invest::by_username>>,
    indexed_by<"byhash"_n, const_mem_fun<program_invest, checksum256, &program_invest::by_hash>>
> program_invest_index;

} // namespace Capital