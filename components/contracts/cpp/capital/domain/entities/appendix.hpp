#pragma once


#include "../../../lib/core/ram_payer.hpp"
using namespace eosio;
using std::string;

namespace Capital::Appendix {
  /**
   * @brief Константы статусов приложений
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    constexpr eosio::name CREATED = "created"_n;     ///< Приложение создано
  }
}

namespace Capital {
  /**
   * @brief Таблица приложений хранит данные о приложениях к договору УХД для конкретных проектов.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): appendixes 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] appendix {
    uint64_t id;                                    ///< ID приложения (внутренний ключ)
    name coopname;                                  ///< Имя кооператива
    name username;                                  ///< Имя пользователя
    checksum256 project_hash;                       ///< Хэш проекта
    checksum256 appendix_hash;                      ///< Хэш приложения
    name status;                                    ///< Статус приложения
    time_point_sec created_at;                      ///< Время создания приложения
    document2 appendix;                             ///< Документ приложения
    
    uint64_t primary_key() const { return id; }     ///< Первичный ключ (1)
    
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_project() const { return project_hash; } ///< Индекс по проекту (3)
    checksum256 by_hash() const { return appendix_hash; } ///< Индекс по хэшу приложения (4)
    uint128_t by_project_user() const { return combine_checksum_ids(project_hash, username); } ///< Индекс по проекту и пользователю (5)
  };

typedef eosio::multi_index<
    "appendixes"_n, appendix,
    indexed_by<"byusername"_n, const_mem_fun<appendix, uint64_t, &appendix::by_username>>,
    indexed_by<"byproject"_n, const_mem_fun<appendix, checksum256, &appendix::by_project>>,
    indexed_by<"byhash"_n, const_mem_fun<appendix, checksum256, &appendix::by_hash>>,
    indexed_by<"byprojuser"_n, const_mem_fun<appendix, uint128_t, &appendix::by_project_user>>
> appendix_index;

}// namespace Capital


namespace Capital::Appendix {
  inline void create_appendix(eosio::name coopname, eosio::name username, checksum256 project_hash, checksum256 appendix_hash, document2 document){
    Capital::appendix_index appendixes(_capital, coopname.value);
    auto appendix_id = get_global_id_in_scope(_capital, coopname, "appendixes"_n);
    
    appendixes.emplace(RamPayer::of(appendixes, coopname), [&](auto &a) {
      a.id = appendix_id;
      a.coopname = coopname;
      a.username = username;
      a.project_hash = project_hash;
      a.appendix_hash = appendix_hash;
      a.status = Capital::Appendix::Status::CREATED;
      a.created_at = current_time_point();
      a.appendix = document;
    }); 
  }

  /**
    * @brief Получает приложение по хэшу
    */
    inline  std::optional<appendix> get_appendix(eosio::name coopname, const checksum256 &appendix_hash) {
      appendix_index appendixes(_capital, coopname.value);
      auto by_hash = appendixes.get_index<"byhash"_n>();
      auto itr = by_hash.find(appendix_hash);
      
      if (itr == by_hash.end()) {
          return std::nullopt;
      }
      
      return appendix(*itr);
    }
  
    /**
     * @brief Удаляет приложение из таблицы appendixes
     */
    inline void delete_appendix(eosio::name coopname, uint64_t appendix_id){
      // Удаляем запись из таблицы appendixes
      Capital::appendix_index appendixes(_capital, coopname.value);
      auto itr = appendixes.find(appendix_id);
      eosio::check(itr != appendixes.end(), "Документ приложения не найден");
      appendixes.erase(itr);
    }
  
}// namespace Capital::Appendix

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::appendix, cooperative);
