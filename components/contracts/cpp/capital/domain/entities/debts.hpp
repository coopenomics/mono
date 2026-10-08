#pragma once


#include "../../../lib/core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;
using std::string;

namespace Capital::Debts {

/**
 * @brief Статусы долгов
 * @ingroup public_consts
 * @ingroup public_capital_consts

 */
namespace Status {
  constexpr name CREATED = "created"_n;       ///< Заявление подано, договор ещё не приложен
  constexpr name PENDING = "pending"_n;       ///< Заявление и договор на рассмотрении совета
  constexpr name AUTHORIZED = "authorized"_n; ///< Совет разрешил, договор ждёт подписи председателя
  constexpr name SIGNED = "signed"_n;         ///< Договор подписан, платёж отклонён по реквизитам — ждёт повтора
  constexpr name PAYING = "paying"_n;         ///< Передан на выплату кассиру
  constexpr name PAID = "paid"_n;             ///< Выплачен пайщику
}

/**
 * @brief Таблица долгов хранит данные о ссудах участников проектов.
 * @ingroup public_tables
 * @ingroup public_capital_tables

 * @par Область памяти (scope): coopname
 * @par Имя таблицы (table): debts 
 */
struct [[eosio::table, eosio::contract(CAPITAL)]] debt {
  uint64_t         id;                        ///< ID долга (внутренний ключ)
  eosio::name      coopname;                  ///< Имя кооператива
  eosio::name      username;                  ///< Имя пользователя
  eosio::name      status = Status::CREATED;  ///< Статус долга (created | approved | authorized | paid)
  checksum256      debt_hash;                 ///< Хэш долга
  checksum256      project_hash;              ///< Хэш проекта
  time_point_sec   repaid_at;                 ///< Дата погашения долга
  asset            amount;                    ///< Сумма долга
  document2        statement;                 ///< Заявление на ссуду
  document2        approved_statement;        ///< Одобренное заявление
  document2        authorization;             ///< Авторизация совета
  std::string      memo;                      ///< Причина последнего отказа платежа
  document2        contract;                  ///< Договор займа с подписью пайщика
  document2        signed_contract;           ///< Договор займа с подписью председателя
  
  uint64_t primary_key() const { return id; } ///< Первичный ключ (1)

  uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
  checksum256 by_debt_hash() const { return debt_hash; } ///< Индекс по хэшу долга (3)
  checksum256 by_project_hash() const { return project_hash; } ///< Индекс по хэшу проекта (4)
};

typedef eosio::multi_index<
  "debts"_n,
  debt,
  indexed_by<"byusername"_n, const_mem_fun<debt, uint64_t, &debt::by_username>>,
  indexed_by<"bydebthash"_n, const_mem_fun<debt, checksum256, &debt::by_debt_hash>>,
  indexed_by<"byprojhash"_n, const_mem_fun<debt, checksum256, &debt::by_project_hash>>
> debts_index;

/**
 * @brief Получает долг по хэшу
 */
inline std::optional<debt> get_debt(eosio::name coopname, const checksum256 &debt_hash) {
  debts_index debts(_capital, coopname.value);
  auto hash_index = debts.get_index<"bydebthash"_n>();

  auto itr = hash_index.find(debt_hash);
  if (itr == hash_index.end()) {
      return std::nullopt;
  }

  return debt(*itr);
}

/**
 * @brief Получает долг по хэшу или падает с ошибкой
 */
inline debt get_debt_or_fail(eosio::name coopname, const checksum256 &debt_hash, const char* msg = "Долг не найден") {
  auto maybe_debt = get_debt(coopname, debt_hash);
  eosio::check(maybe_debt.has_value(), msg);
  return maybe_debt.value();
}

/**
 * @brief Создает долг в таблице
 */
inline void create_debt(
  eosio::name coopname,
  eosio::name username, 
  const checksum256 &project_hash,
  const checksum256 &debt_hash,
  const asset &amount,
  const time_point_sec &repaid_at,
  const document2 &statement,
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;
  
  debts_index debts(_capital, coopname.value);
  auto debt_id = get_global_id_in_scope(_capital, coopname, "debts"_n);
  
  debts.emplace(RamPayer::of(debts, coopname), [&](auto &d){
    d.id = debt_id;
    d.coopname = coopname;
    d.username = username;
    d.status = Status::CREATED;
    d.debt_hash = debt_hash;
    d.project_hash = project_hash;
    d.amount = amount;
    d.statement = statement;
    d.repaid_at = repaid_at;
  });
}

/**
 * @brief Обновляет статус долга
 */
inline void update_debt_status(
  eosio::name coopname,
  uint64_t debt_id,
  eosio::name new_status,
  eosio::name payer = name{},
  const document2 &document = document2{},
  const std::string &memo = ""
) {
  if (payer == name{}) payer = coopname;
  
  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  
  debts.modify(debt, RamPayer::of(debts, coopname), [&](auto &d) {
    d.status = new_status;
    
    if (new_status == Status::PENDING) {
      d.contract = document;
    } else if (new_status == Status::AUTHORIZED) {
      d.authorization = document;
    } else if (new_status == Status::PAYING && !is_empty_document(document)) {
      d.signed_contract = document;
    }

    // Причина отказа платежа живёт, пока заём ждёт повтора; с новой выплатой стирается.
    if (new_status == Status::SIGNED) {
      d.memo = memo;
    } else if (new_status == Status::PAYING) {
      d.memo.clear();
    }
  });
}

/**
 * @brief Удаляет долг
 */
/** Частичное погашение: остаток займа уменьшается на сумму возврата. */
inline void decrease_debt_amount(eosio::name coopname, uint64_t debt_id, const asset &amount) {
  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  debts.modify(debt, RamPayer::of(debts, coopname), [&](auto &d) { d.amount -= amount; });
}

inline void delete_debt(eosio::name coopname, uint64_t debt_id) {
  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  
  eosio::check(debt != debts.end(), "Долг не найден");
  
  debts.erase(debt);
}

/**
 * Запрос подписи председателя на договоре займа — после решения совета.
 * Отказ председателя отменяет заём тем же действием, что и отказ совета.
 */
inline void create_contract_approval(
  eosio::name coopname,
  eosio::name username,
  const checksum256 &debt_hash,
  const document2 &contract
) {
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    contract,
    Names::Capital::SIGN_DEBT_CONTRACT,
    debt_hash,
    _capital,
    Names::Capital::ON_DEBT_SIGNED,
    Names::Capital::DECLINE_DEBT,
    std::string("")
  );
}

/** Исходящий платёж кассиру; отказ по реквизитам возвращает заём к повтору. */
inline void create_debt_outcome(eosio::name coopname, const debt &d) {
  ::Gateway::create_outcome(
    _capital,
    coopname,
    d.username,
    d.debt_hash,
    d.amount,
    _capital,
    Names::Capital::CONFIRM_DEBT_PAYMENT,
    Names::Capital::DECLINE_DEBT_PAYMENT
  );
}

/**
 * @brief Создает агенду в совете для долга
 */
inline void create_debt_agenda(
  eosio::name coopname,
  eosio::name username,
  const checksum256 &debt_hash,
  const document2 &statement
) {
  ::Soviet::create_agenda(
    _capital,
    coopname,
    username, 
    Names::SovietActions::CREATE_DEBT,
    debt_hash, 
    _capital, 
    Names::Capital::AUTHORIZE_DEBT, 
    Names::Capital::DECLINE_DEBT, 
    statement, 
    std::string("")
  );
}




} // namespace Capital::Debts

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::Debts::debt, cooperative);
