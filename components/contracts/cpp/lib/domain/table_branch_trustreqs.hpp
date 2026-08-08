#pragma once

#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "document_core.hpp"

/**
 * @file
 * Заявки на приём доверенным лицом кооперативного участка.
 * Pending-таблица: заявитель подаёт подписанные заявление и договор о полной
 * материальной ответственности; председатель участка одобряет встречной подписью —
 * пайщик добавляется в trusted участка, заявка стирается (история — в журнале действий).
 */

/**
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: trustreqs
 */
struct [[eosio::table, eosio::contract(BRANCH)]] trustreq {
  uint64_t id;                  ///< Идентификатор заявки
  eosio::checksum256 hash;      ///< Внешний идентификатор заявки
  eosio::name coopname;         ///< Имя кооператива
  eosio::name braname;          ///< Кооперативный участок
  eosio::name username;         ///< Заявитель
  document2 application;        ///< Договор о полной материальной ответственности доверенного лица (подписан заявителем)
  document2 authority;          ///< Доверенность доверенному лицу/оператору участка (подписана заявителем, ждёт встречной подписи председателя участка)

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }
};

typedef eosio::multi_index<
    "trustreqs"_n, trustreq,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<trustreq, eosio::checksum256, &trustreq::by_hash>>>
    trustreq_index;

inline trustreq get_trustreq_or_fail(eosio::name coopname, eosio::checksum256 hash) {
  trustreq_index trustreqs(_branch, coopname.value);
  auto idx = trustreqs.get_index<"byhash"_n>();
  auto itr = idx.find(hash);
  eosio::check(itr != idx.end(), "Заявка доверенного не найдена");
  return *itr;
}
