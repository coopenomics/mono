#pragma once


#include "../../../lib/core/ram_payer.hpp"
using namespace eosio;
using std::string;

namespace Capital::ProgramWithdraw {
  /**
   * @brief Константы статусов возвратов из программы
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    const eosio::name CREATED = "created"_n;     ///< Запрос на возврат создан
    const eosio::name APPROVED = "approved"_n;   ///< Запрос на возврат одобрен
  }
}

namespace Capital {

  /**
   * @brief Таблица возвратов из программы хранит данные о запросах на возврат средств из программы благороста.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): prgwithdraws 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] program_withdraw {
    uint64_t id;                                ///< ID запроса на возврат (внутренний ключ)
    name coopname;                              ///< Имя кооператива
    checksum256 withdraw_hash;                  ///< Хэш запроса на возврат
    name username;                              ///< Имя участника, запрашивающего возврат
    name status;                                ///< Статус запроса (created | approved)
    asset amount = asset(0, _root_govern_symbol); ///< Запрошенная сумма для возврата
    document2 statement;                        ///< Заявление на возврат паевого взноса деньгами
  
    time_point_sec created_at = current_time_point(); ///< Время создания запроса
  
    uint64_t primary_key() const { return id; } ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_hash() const { return withdraw_hash; } ///< Индекс по хэшу запроса (3)
  };

typedef eosio::multi_index<"prgwithdraws"_n, program_withdraw,
  indexed_by<"byhash"_n, const_mem_fun<program_withdraw, checksum256, &program_withdraw::by_hash>>,
  indexed_by<"byusername"_n, const_mem_fun<program_withdraw, uint64_t, &program_withdraw::by_username>>
> program_withdraws_index; ///< Таблица для хранения запросов на возврат из проекта.


inline std::optional<program_withdraw> get_program_withdraw(eosio::name coopname, const checksum256 &hash) {
  program_withdraws_index program_withdraws(_capital, coopname.value);
  auto index = program_withdraws.get_index<"byhash"_n>();

  auto itr = index.find(hash);
  
  if (itr == index.end()) {
      return std::nullopt;
  }

  return program_withdraw(*itr);
}


} // namespace Capital

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::program_withdraw, cooperative);
