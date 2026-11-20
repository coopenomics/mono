#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

using eosio::checksum256;

/**
 * @brief Состояния пакета выплаты поставщику.
 *
 *   open     — узел наполняет пакет: `addpayout` добавляет заказ, сумма растёт.
 *   sent     — `sendpayout` закрыл пакет и зарегистрировал один исходящий
 *              платёж в gateway на итоговую сумму; сумма больше не меняется.
 *   paid     — кассир подтвердил перевод (`payconfirm`); заказы пакета
 *              закрываются по одному (`closepayout`, Дт 76 / Кт 51 на заказ).
 *   declined — кассир отказал (`paydecline`); заказы возвращаются в ожидание
 *              выплаты по одному (`releasepay`) и попадут в следующий пакет.
 *
 * Строка стирается, когда в пакете не остаётся заказов (`orders == 0`):
 * журнал прошлых выплат в оперативной памяти контракта не копится, история
 * остаётся в журнале действий.
 */
namespace PayoutStatus {
  inline constexpr eosio::name OPEN     = "open"_n;
  inline constexpr eosio::name SENT     = "sent"_n;
  inline constexpr eosio::name PAID     = "paid"_n;
  inline constexpr eosio::name DECLINED = "declined"_n;
}

/**
 * @brief Пакет выплаты поставщику (решение владельца 19.11.2026).
 *
 * Пайщики заказывают у одного поставщика помногу, и выплата по каждому заказу
 * давала кассиру десятки платежей одному получателю с одним назначением по
 * договору. Пакет собирает все принятые и ещё не оплаченные заказы поставщика
 * в конце дня в один исходящий платёж. Сумму пакета считает контракт: каждый
 * `addpayout` прибавляет принятую стоимость заказа за вычетом удержанного
 * гарантийного долга. После `sendpayout` сумма не меняется — кассир платит ровно
 * то, что зарегистрировано в gateway; заказ, принятый позже, попадает в пакет
 * следующего дня.
 *
 * `hash` — `outcome_hash` исходящего платежа в gateway и ключ обратных вызовов
 * `payconfirm` / `paydecline`. Его называет узел при первом `addpayout`;
 * контракт проверяет уникальность.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: payouts
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] payout {
  uint64_t     id;                  ///< суррогатный ключ (scope coopname)
  checksum256  hash;                ///< хэш пакета — outcome_hash исходящего платежа в gateway
  eosio::name  offerer;             ///< поставщик — получатель выплаты
  eosio::name  status;              ///< состояние (namespace PayoutStatus)
  eosio::asset amount;              ///< сумма перевода: Σ(принятая стоимость − удержание) по заказам пакета
  eosio::asset withheld;            ///< удержано в счёт признанного гарантийного долга по заказам пакета
  uint32_t     orders = 0;          ///< заказов в пакете, ещё не закрытых `closepayout` / `releasepay`
  eosio::time_point_sec created_at; ///< время первого `addpayout`
  std::string  decline_reason;      ///< причина отказа кассира (только для declined)

  uint64_t    primary_key() const { return id; }
  checksum256 by_hash() const { return hash; }
  uint64_t    by_offerer() const { return offerer.value; }
};

typedef eosio::multi_index<
    "payouts"_n, payout,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<payout, checksum256, &payout::by_hash>>,
    eosio::indexed_by<"byofferer"_n, eosio::const_mem_fun<payout, uint64_t, &payout::by_offerer>>>
    payouts_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp:
// пакет выплаты — бизнес-процесс кооператива, платит кооператив.
RAM_PAYER_CLASS(payout, cooperative);
