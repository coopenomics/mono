#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <optional>
#include <string>

#include "../consts.hpp"

/**
 * @brief Дедуп-журнал оплат подписок контракта `billing` (Epic 12).
 *
 * Единственная таблица контракта `billing`. Хранит ТОЛЬКО факт проведённого
 * списания по `payment_hash` — для идемпотентности повторных вызовов `pay`
 * (по образцу `transaction_id`-идемпотентности платежей в провайдере, Epic 3).
 * Состав подписок, цены и даты on-chain НЕ хранятся — это зона ответственности
 * оператора (provider backend); `payment_hash` — ссылка на запись в его БД.
 */
namespace Billing {

using namespace eosio;

struct [[eosio::table, eosio::contract(BILLING)]] payment {
  uint64_t      id;
  name          coopname;
  name          username;
  asset         amount;
  checksum256   payment_hash;
  time_point_sec paid_at;

  uint64_t primary_key() const { return id; }
  checksum256 by_payment_hash() const { return payment_hash; }
  uint64_t by_username() const { return username.value; }
};

typedef multi_index<
    "payments"_n, payment,
    indexed_by<"bypayhash"_n, const_mem_fun<payment, checksum256, &payment::by_payment_hash>>,
    indexed_by<"byusername"_n, const_mem_fun<payment, uint64_t, &payment::by_username>>>
    payments_index;

/**
 * @brief Возвращает запись об оплате по payment_hash (для дедупа), если есть.
 */
inline std::optional<payment> get_payment(name coopname, const checksum256 &payment_hash) {
  payments_index payments(_billing, coopname.value);
  auto by_hash = payments.get_index<"bypayhash"_n>();
  auto it = by_hash.find(payment_hash);
  if (it == by_hash.end())
    return std::nullopt;
  return *it;
}

} // namespace Billing
