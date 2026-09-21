#pragma once


#include "../../../lib/core/ram_payer.hpp"
using namespace eosio;
using std::string;

namespace Capital::Results {
  /**
   * @brief Константы статусов результата
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    const eosio::name CREATED = "created"_n;     ///< Заявление подано
    const eosio::name APPROVED = "approved"_n;       ///< Одобрено председателем
    const eosio::name AUTHORIZED = "authorized"_n;   ///< Авторизовано советом
    const eosio::name ACT1 = "act1"_n;              ///< Акт передачи подписан
    const eosio::name ACT2 = "act2"_n;              ///< Акт приёма подписан
    const eosio::name DECLINED = "declined"_n;       ///< Отклонено советом
  }
}

namespace Capital {

  /**
   * @brief Таблица результатов хранит данные о результатах участников проектов.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): results 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] result {
    uint64_t id;                                    ///< ID результата (внутренний ключ)
    checksum256 project_hash;                       ///< Хэш проекта
    checksum256 result_hash;                        ///< Хэш результата
    
    eosio::name coopname;                           ///< Имя кооператива
    eosio::name username;                           ///< Имя пользователя

    eosio::name status = Capital::Results::Status::CREATED; ///< Статус результата: created | approved | authorized | declined | act1 | act2
    time_point_sec created_at = current_time_point(); ///< Время создания результата

    eosio::asset debt_amount = asset(0, _root_govern_symbol);          ///< Сумма долга
    eosio::asset total_amount = asset(0, _root_govern_symbol);         ///< Общая сумма
    
    document2 statement;                            ///< Заявление
    document2 authorization;                        ///< Решение совета
    document2 act;                                  ///< Акт
  
    uint64_t primary_key() const { return id; }     ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_hash() const { return result_hash; } ///< Индекс по хэшу результата (3)
    checksum256 by_project_hash() const { return project_hash; } ///< Индекс по хэшу проекта (4)
  
    uint128_t by_project_user() const {             ///< Индекс по проекту и пользователю (5)
        return combine_checksum_ids(project_hash, username);
    }
  };

typedef eosio::multi_index<"results"_n, result,
  indexed_by<"byusername"_n, const_mem_fun<result, uint64_t, &result::by_username>>,
  indexed_by<"byhash"_n, const_mem_fun<result, checksum256, &result::by_hash>>,
  indexed_by<"byprojecthash"_n, const_mem_fun<result, checksum256, &result::by_project_hash>>,
  indexed_by<"byprojuser"_n, const_mem_fun<result, uint128_t, &result::by_project_user>>
> result_index;


namespace Results {

inline std::optional<result> get_result(eosio::name coopname, const checksum256 &result_hash) {
  result_index results(_capital, coopname.value);
  auto idx = results.get_index<"byhash"_n>();
  
  auto it = idx.find(result_hash);
  if (it == idx.end()) {
      return std::nullopt;
  }
  return result(*it);
}

inline std::optional<result> get_result_by_project_and_username(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
  result_index results(_capital, coopname.value);
  auto idx = results.get_index<"byprojuser"_n>();
  auto rkey = combine_checksum_ids(project_hash, username);

  auto it = idx.find(rkey);
  if (it == idx.end()) {
      return std::nullopt;
  }
  return result(*it);
}

inline result get_result_by_project_and_username_or_fail(eosio::name coopname, const checksum256 &project_hash, eosio::name username, const char* msg) {
  auto c = get_result_by_project_and_username(coopname, project_hash, username);
  eosio::check(c.has_value(), msg);
  return c.value();
}

/**
 * @brief Создает результат для конкретного участника
 */
inline void create_result_for_participant(eosio::name coopname, const checksum256 &project_hash, 
                                         eosio::name username, const checksum256 &result_hash,
                                         eosio::asset segment_cost, eosio::asset debt_amount, const document2 &statement) {
    result_index results(_capital, coopname.value);
    
    results.emplace(RamPayer::of(results, coopname), [&](auto &r) {
        r.id = get_global_id_in_scope(_capital, coopname, "results"_n);
        r.project_hash = project_hash;
        r.result_hash = result_hash;
        r.coopname = coopname;
        r.username = username;
        r.status = Capital::Results::Status::CREATED; 
        r.total_amount = segment_cost;
        r.debt_amount = debt_amount;
        r.statement = statement;
        r.created_at = current_time_point();
    });
}


/**
 * @brief Удаляет объект результата
 */
inline void delete_result(eosio::name coopname, uint64_t result_id) {
    result_index results(_capital, coopname.value);
    auto result = results.find(result_id);
    eosio::check(result != results.end(), "Объект результата не найден");

    results.erase(result);
}

/**
 * @brief Обновляет статус результата
 */
inline void update_result_status(eosio::name coopname, uint64_t result_id, eosio::name new_status) {
    result_index results(_capital, coopname.value);
    auto result = results.find(result_id);
    eosio::check(result != results.end(), "Объект результата не найден");

    results.modify(result, RamPayer::of(results, coopname), [&](auto &r){
        r.status = new_status;
    });
}

/**
 * @brief Устанавливает документ авторизации результата
 */
inline void set_result_authorization(eosio::name coopname, uint64_t result_id, const document2 &authorization) {
    result_index results(_capital, coopname.value);
    auto result = results.find(result_id);
    eosio::check(result != results.end(), "Объект результата не найден");

    results.modify(result, RamPayer::of(results, coopname), [&](auto &r){
        r.authorization = authorization;
    });
}

/**
 * @brief Устанавливает одобренное заявление результата
 */
inline void set_result_approved_statement(eosio::name coopname, uint64_t result_id, const document2 &approved_statement) {
    result_index results(_capital, coopname.value);
    auto result = results.find(result_id);
    eosio::check(result != results.end(), "Объект результата не найден");

    results.modify(result, RamPayer::of(results, coopname), [&](auto &r){
        r.statement = approved_statement;
    });
}

/**
 * @brief Устанавливает первый акт результата
 */
inline void set_result_act1(eosio::name coopname, uint64_t result_id, const document2 &act) {
    result_index results(_capital, coopname.value);
    auto result = results.find(result_id);
    eosio::check(result != results.end(), "Объект результата не найден");

    results.modify(result, RamPayer::of(results, coopname), [&](auto &r){
        r.act = act;
    });
}

/**
 * @brief Устанавливает второй акт результата
 */
inline void set_result_act2(eosio::name coopname, uint64_t result_id, const document2 &act) {
    result_index results(_capital, coopname.value);
    auto result = results.find(result_id);
    eosio::check(result != results.end(), "Объект результата не найден");

    results.modify(result, RamPayer::of(results, coopname), [&](auto &r){
        r.act = act;
    });
}

/**
 * @brief Отправляет результат на рассмотрение в совет
 */
inline void send_result_to_soviet(eosio::name coopname, eosio::name username, const checksum256 &result_hash, const document2 &approved_statement) {
  ::Soviet::create_agenda(
    _capital,
    coopname, 
    username, 
    Names::SovietActions::CREATE_RESULT, 
    result_hash,
    _capital, 
    Names::Capital::AUTHORIZE_RESULT, 
    Names::Capital::DECLINE_RESULT, 
    approved_statement, 
    std::string("")
  );
}

/**
 * @brief Отправляет результат на одобрение председателем
 */
inline void send_result_for_approval(eosio::name coopname, eosio::name username, const checksum256 &result_hash, const document2 &statement) {
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    statement,
    Names::Capital::CREATE_RESULT,
    result_hash,
    _capital,
    Names::Capital::APPROVE_RESULT,
    Names::Capital::DECLINE_RESULT,
    std::string("")
  );
}

} // namespace Results

} // namespace Capital

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::result, cooperative);
