#pragma once

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
  constexpr name CREATED = "created"_n;        ///< Долг создан
  constexpr name APPROVED = "approved"_n;      ///< Долг одобрен председателем
  constexpr name AUTHORIZED = "authorized"_n;  ///< Долг авторизован советом, ожидает повторной отправки на оплату
  constexpr name PAY_PENDING = "paypending"_n; ///< Долг отправлен в gateway на оплату (исходящий платёж создан, ждём debtpaycnfrm/debtpaydcln)
  constexpr name PAID = "paid"_n;              ///< Долг выплачен пайщику, активный (ждёт погашения)
  constexpr name SETTLED = "settled"_n;        ///< Долг полностью погашен (деньгами через settledebt либо результатом через signact2)
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
  std::string      memo;                      ///< Примечание
  std::string      last_pay_error;            ///< Последняя ошибка outpay от gateway (заполняется debtpaydcln; пусто = успех или ещё не отправлен)

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
  
  debts.emplace(payer, [&](auto &d){
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
  
  debts.modify(debt, payer, [&](auto &d) {
    d.status = new_status;
    
    if (new_status == Status::APPROVED) {
      d.approved_statement = document;
    } else if (new_status == Status::AUTHORIZED) {
      d.authorization = document;
    }
    
    if (!memo.empty()) {
      d.memo = memo;
    }
  });
}

/**
 * @brief Переводит долг в PAY_PENDING — фиксирует решение совета и факт отправки в gateway.
 * Допустимо из APPROVED (первая отправка после авторизации совета) или из AUTHORIZED
 * (повторная отправка после предыдущего отказа gateway). Очищает last_pay_error.
 */
inline void start_pay(
  eosio::name coopname,
  uint64_t debt_id,
  const document2 &authorization,
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;

  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  eosio::check(debt->status == Status::APPROVED || debt->status == Status::AUTHORIZED,
               "Старт оплаты допустим только из approved/authorized");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::PAY_PENDING;
    d.authorization = authorization;
    d.last_pay_error = "";
  });
}

/**
 * @brief Возвращает долг из PAY_PENDING в AUTHORIZED с записью причины ошибки оплаты.
 * Долг не удаляется — решение совета уже принято, доступна повторная отправка в gateway.
 */
inline void mark_pay_declined(
  eosio::name coopname,
  uint64_t debt_id,
  const std::string &reason,
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;

  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  eosio::check(debt->status == Status::PAY_PENDING,
               "Отказ оплаты допустим только из статуса pay_pending");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::AUTHORIZED;
    d.last_pay_error = reason;
  });
}

/**
 * @brief Закрывает долг как погашенный — переводит в SETTLED, сохраняет документ-основание
 *        в поле memo (если передан) и фиксирует дату погашения.
 *
 * Деньги и проводка REPAY к этому моменту уже должны быть применены в Ledger2,
 * а contributors.debt_amount — уменьшен. Функция отвечает только за состояние записи.
 */
inline void mark_settled(
  eosio::name coopname,
  uint64_t debt_id,
  const std::string &settle_memo = "",
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;

  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  eosio::check(debt->status == Status::PAID,
               "Погашение допустимо только из статуса paid");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::SETTLED;
    d.repaid_at = eosio::current_time_point();
    if (!settle_memo.empty()) {
      d.memo = settle_memo;
    }
  });
}

/**
 * @brief Удаляет долг
 */
inline void delete_debt(eosio::name coopname, uint64_t debt_id) {
  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  
  eosio::check(debt != debts.end(), "Долг не найден");
  
  debts.erase(debt);
}

/**
 * @brief Создает аппрув для долга
 */
inline void create_debt_approval(
  eosio::name coopname,
  eosio::name username,
  const checksum256 &debt_hash,
  const document2 &statement
) {
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    statement,
    Names::Capital::CREATE_DEBT,
    debt_hash,
    _capital,
    "approvedebt"_n,
    "declinedebt"_n,
    std::string("")
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