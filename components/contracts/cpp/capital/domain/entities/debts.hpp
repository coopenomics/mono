#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>

using namespace eosio;
using std::string;

namespace Capital::Debts {

/**
 * @brief Статусы долгов
 * @ingroup public_consts
 * @ingroup public_capital_consts

 */
namespace Status {
  constexpr name CREATED = "created"_n;        ///< Заявка на займ подана
  constexpr name APPROVED = "approved"_n;      ///< Заявку одобрил председатель
  constexpr name AUTHORIZED = "authorized"_n;  ///< Совет разрешил выдачу; платёж ещё не отправлен либо вернулся с отказом по реквизитам
  constexpr name PAY_PENDING = "paypending"_n; ///< Платёж отправлен, ждём подтверждения или отказа
  constexpr name PAID = "paid"_n;              ///< Займ выдан пайщику и ждёт возврата
  constexpr name OVERDUE = "overdue"_n;        ///< Срок возврата прошёл
  constexpr name SETTLED = "settled"_n;        ///< Займ возвращён — деньгами или сдачей результата
  constexpr name WRITEOFF = "writeoff"_n;      ///< Займ списан: работа-обеспечение перешла кооперативу
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

  // Хвост binary_extension: таблица уже в продакшене, схема расширяется только с конца.
  eosio::binary_extension<std::string>    last_pay_error; ///< Причина отказа по реквизитам от последней отправки платежа; пусто — отказа не было
  eosio::binary_extension<time_point_sec> due_at;         ///< Срок возврата займа; после него займ переводится в просрочку

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
/**
 * @brief Причина отказа по реквизитам у займа, записанного до появления этого поля, — пустая.
 */
inline std::string read_last_pay_error(const debt &d) {
  return d.last_pay_error.has_value() ? *d.last_pay_error : std::string{};
}

/**
 * @brief Срок возврата у займа, записанного до появления этого поля, — не задан.
 */
inline time_point_sec read_due_at(const debt &d) {
  return d.due_at.has_value() ? *d.due_at : time_point_sec();
}

/**
 * @brief Стандартный срок возврата займа — год со дня выдачи.
 *
 * Срок не привязан к сроку работ по компоненту: пайщик возвращает займ деньгами
 * или сдачей результата, и то и другое может случиться раньше. Если компонент
 * отменён и сдавать результат уже некуда, займ закрывается досрочно — работа
 * переходит кооперативу (см. closedebt).
 */
constexpr uint32_t DEFAULT_DEBT_TERM_SECONDS = 365 * 24 * 60 * 60;

/**
 * @brief Сколько незакрытых займов пайщика на одном компоненте закрывается одной сдачей результата.
 *
 * Предел нужен, чтобы обход займов компонента укладывался в лимит транзакции.
 * Займы сверх него закрываются деньгами до сдачи результата.
 */
constexpr uint32_t MAX_ACTIVE_DEBTS_PER_PROJECT = 10;

/**
 * @brief Отправляет заём на выплату: фиксирует решение совета и ставит займ в ожидание платежа.
 *
 * Допустимо после одобрения советом, а также повторно — после отказа
 * по реквизитам, когда решение совета уже принято и заново не требуется.
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
               "Отправить заём на выплату можно после одобрения советом");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::PAY_PENDING;
    d.authorization = authorization;
    d.last_pay_error.emplace("");
  });
}

/**
 * @brief Возвращает заём в состояние «разрешён советом» с причиной отказа по реквизитам.
 *
 * Запись не удаляется: решение совета остаётся в силе, платёж можно отправить
 * повторно, не собирая совет заново.
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
               "Отказ по реквизитам возможен только по отправленному платежу");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::AUTHORIZED;
    d.last_pay_error.emplace(reason);
  });
}

/**
 * @brief Отмечает заём выданным и назначает срок возврата.
 */
inline void confirm_paid(
  eosio::name coopname,
  uint64_t debt_id,
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;

  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  eosio::check(debt->status == Status::PAY_PENDING,
               "Подтвердить выдачу можно только по отправленному платежу");

  auto now = eosio::current_time_point();
  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::PAID;
    d.due_at.emplace(eosio::time_point_sec(now.sec_since_epoch() + DEFAULT_DEBT_TERM_SECONDS));
    d.last_pay_error.emplace("");
  });
}

/**
 * @brief Переводит в просрочку выданные займы, срок возврата которых прошёл.
 *
 * За один вызов обрабатывается не больше @p batch_limit записей — иначе на
 * кооперативе с большим числом займов операция не уложится в лимит транзакции.
 * Вызывающая сторона повторяет, пока не вернётся ноль.
 *
 * @return сколько займов переведено в просрочку этим вызовом
 */
inline uint32_t sweep_overdue(
  eosio::name coopname,
  uint32_t batch_limit
) {
  debts_index debts(_capital, coopname.value);
  auto now_sec = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  uint32_t marked = 0;
  for (auto it = debts.begin(); it != debts.end() && marked < batch_limit; ++it) {
    const auto due = read_due_at(*it);
    if (it->status == Status::PAID && due != time_point_sec() && now_sec > due) {
      debts.modify(it, coopname, [&](auto &d) {
        d.status = Status::OVERDUE;
      });
      ++marked;
    }
  }
  return marked;
}

/**
 * @brief Отмечает заём возвращённым.
 */
inline void mark_settled(
  eosio::name coopname,
  uint64_t debt_id,
  const std::string &memo = "",
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;

  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  eosio::check(debt->status == Status::PAID || debt->status == Status::OVERDUE,
               "Вернуть можно только выданный или просроченный заём");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::SETTLED;
    d.repaid_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    if (!memo.empty()) d.memo = memo;
  });
}

/**
 * @brief Отмечает заём списанным: работа-обеспечение перешла кооперативу.
 */
inline void mark_writeoff(
  eosio::name coopname,
  uint64_t debt_id,
  const std::string &memo = "",
  eosio::name payer = name{}
) {
  if (payer == name{}) payer = coopname;

  debts_index debts(_capital, coopname.value);
  auto debt = debts.find(debt_id);
  eosio::check(debt != debts.end(), "Долг не найден");
  eosio::check(debt->status == Status::PAID || debt->status == Status::OVERDUE,
               "Списать можно только выданный или просроченный заём");

  debts.modify(debt, payer, [&](auto &d) {
    d.status = Status::WRITEOFF;
    d.repaid_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    if (!memo.empty()) d.memo = memo;
  });
}

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