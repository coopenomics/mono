#pragma once


#include "../../../lib/core/ram_payer.hpp"
using namespace eosio;
using std::string;

namespace Capital {
  //TODO: УДАЛИТЬ после 07.2026 т.к. не используем
  /**
   * @brief Таблица программных инвестиций (progrinvests): ранее использовалась для заявок на зачёт с этапом одобрения советом; при текущей логике createpinv строки не создаёт, таблица сохранена для совместимости и чтения исторических записей.
   * @deprecated description: не используется
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): progrinvests 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] program_invest {
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

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::program_invest, cooperative);
