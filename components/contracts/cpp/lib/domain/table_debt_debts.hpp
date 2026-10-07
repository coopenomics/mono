#pragma once


#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

namespace Debt {

using namespace eosio;

/**
 * @brief Состояния займа.
 * @ingroup public_debt_consts
 *
 * Запись живёт в памяти цепи только пока заём открыт: на терминальном шаге
 * (возврат, списание, отказ, отмена) строка удаляется, история остаётся в
 * зеркале контроллера по дельтам и действиям цепи.
 */
namespace Status {
  constexpr name CREATED    = "created"_n;    ///< Заявление и договор подписаны пайщиком, обеспечение заблокировано, повестка в совете
  constexpr name AUTHORIZED = "authorized"_n; ///< Совет разрешил выдачу, договор ждёт подписи председателя
  constexpr name SIGNED     = "signed"_n;     ///< Председатель подписал договор, сумма начислена к выдаче
  constexpr name PAYING     = "paying"_n;     ///< Платёж передан кассиру
  constexpr name ISSUED     = "issued"_n;     ///< Заём выдан, идёт срок возврата
  constexpr name OVERDUE    = "overdue"_n;    ///< Срок возврата прошёл
}

/**
 * @brief Запись о беспроцентном займе.
 * @ingroup public_debt_tables
 *
 * @par Область памяти (scope): coopname
 * @par Имя таблицы (table): debts
 *
 * Займы под обеспечение паевым взносом контракт выдаёт сам (`collateral` —
 * ключ реестра обеспечения, `source` — `debt`). Займы других приложений
 * регистрируются при выдаче (`source` — контракт-источник, `source_ref` —
 * ссылка на его сущность, `collateral` пустой).
 */
struct [[eosio::table, eosio::contract(DEBT_CONTRACT)]] debt {
  uint64_t       id;                 ///< Внутренний идентификатор
  name           coopname;           ///< Кооператив
  name           username;           ///< Пайщик-заёмщик
  name           status;             ///< Состояние (Debt::Status)
  checksum256    debt_hash;          ///< Хэш займа; его короткая форма — номер договора
  name           collateral;         ///< Ключ реестра обеспечения; пусто у займов других приложений
  name           source;             ///< Контракт-источник записи
  checksum256    source_ref;         ///< Ссылка источника (у Генерации — хэш проекта)
  asset          amount;             ///< Сумма займа
  asset          remaining;          ///< Остаток к возврату
  asset          pledged;            ///< Сумма на кошельке обеспечения
  time_point_sec created_at;         ///< Подача заявления
  time_point_sec issued_at;          ///< Выдача
  time_point_sec due_at;             ///< Срок возврата
  time_point_sec requested_due_at;   ///< Запрошенный срок при продлении
  time_point_sec overdue_at;         ///< Переход в просрочку
  document2      statement;          ///< Заявление на получение займа
  document2      contract;           ///< Договор с подписью пайщика
  document2      signed_contract;    ///< Договор с подписью председателя
  document2      decision;           ///< Решение совета
  document2      extension_statement;///< Заявление о продлении срока
  std::string    last_pay_error;     ///< Причина последнего отказа платежа
  std::string    memo;               ///< Заметка

  uint64_t primary_key() const { return id; }
  uint64_t by_username() const { return username.value; }
  checksum256 by_debt_hash() const { return debt_hash; }
  uint64_t by_status() const { return status.value; }
  uint64_t by_due() const { return due_at.sec_since_epoch(); }
  uint64_t by_source() const { return source.value; }
};

typedef multi_index<
    "debts"_n, debt,
    indexed_by<"byusername"_n, const_mem_fun<debt, uint64_t, &debt::by_username>>,
    indexed_by<"bydebthash"_n, const_mem_fun<debt, checksum256, &debt::by_debt_hash>>,
    indexed_by<"bystatus"_n, const_mem_fun<debt, uint64_t, &debt::by_status>>,
    indexed_by<"bydue"_n, const_mem_fun<debt, uint64_t, &debt::by_due>>,
    indexed_by<"bysource"_n, const_mem_fun<debt, uint64_t, &debt::by_source>>>
    debts_index;

} // namespace Debt

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Debt::debt, cooperative);
