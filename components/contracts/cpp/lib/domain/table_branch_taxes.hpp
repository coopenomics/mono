#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"

/**
 * @brief Заявка на перечисление удержанного НДФЛ в бюджет (requirement b6
 * «Экономика КУ», процесс p.brn.aid; решение владельца 2026-08-13).
 *
 * Удерживая налог с материальной помощи (o.brn.aidtax), кооператив копит
 * обязательство перед бюджетом на счёте 68 — его остаток виден как баланс
 * кошелька `w.brn.ndfl`. Гасится обязательство не по каждой выплате, а единым
 * налоговым платежом: бухгалтер отправляет накопленное на оплату, заявка
 * попадает к кассиру в реестр исходящих платежей, кассир платит по реквизитам
 * налоговой и подтверждает — callback `taxconfirm` применяет o.brn.taxpay
 * (Дт 68 / Кт 51).
 *
 * Решение совета здесь не требуется: перечисление удержанного налога — прямая
 * обязанность налогового агента, а не распоряжение средствами кооператива.
 * Деньги, которые уходят этим платежом, уже вычтены из выплаты получателю.
 *
 * Наличие записи = заявка в работе. Финал любого рода (перечислено, кассир
 * не смог) стирает запись — история остаётся в журнале действий.
 *
 * scope = coopname; primary_key = id; уникальность по hash через `byhash` —
 * этот hash используется как outcome_hash в gateway и как process_hash
 * ledger2-операции.
 *
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: taxes
 */
struct [[eosio::table, eosio::contract(BRANCH)]] branch_tax {
  uint64_t           id;          ///< суррогатный ключ (scope coopname)
  eosio::checksum256 hash;        ///< идентификатор заявки (= outcome_hash в gateway, = process_hash в ledger2)
  eosio::asset       amount;      ///< сумма к перечислению (≤ остатка w.brn.ndfl на момент создания)
  eosio::time_point_sec created_at = eosio::current_time_point();

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
};

typedef eosio::multi_index<
    "taxes"_n, branch_tax,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<branch_tax, eosio::checksum256, &branch_tax::by_hash>>>
    branch_taxes_index;
