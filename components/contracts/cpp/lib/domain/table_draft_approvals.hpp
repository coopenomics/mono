#pragma once

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <optional>

#include "../consts.hpp"
#include "table_draft_drafts.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_draft_tables
 * @par scope: coopname
 * @par table: approvals
 *
 * Утверждённая советом кооператива редакция шаблона документа.
 *
 * Текст шаблона хранится один раз в глобальной области (`drafts` со scope
 * `_draft`), кооператив запоминает только номер редакции, которую принял его
 * совет, и реквизиты решения. Пока строки нет, кооператив живёт по текущей
 * редакции сети (переходный режим до миграции утверждений из `vars`).
 */
struct [[eosio::table, eosio::contract(DRAFT)]] draftapproval {
  uint64_t registry_id;             ///< Номер шаблона в реестре документов
  uint64_t version;                 ///< Утверждённая редакция
  uint64_t decision_id;             ///< Номер решения совета (номер протокола)
  eosio::time_point_sec approved_at; ///< Дата решения совета
  eosio::checksum256 text_hash;     ///< Хэш текста утверждённой редакции

  uint64_t primary_key() const { return registry_id; }
};

typedef eosio::multi_index<"approvals"_n, draftapproval> draft_approvals_index;

/**
 * Строка утверждения шаблона кооперативом, если совет его утверждал.
 */
inline std::optional<draftapproval> get_draft_approval(eosio::name coopname, uint64_t registry_id) {
  draft_approvals_index approvals(_draft, coopname.value);
  auto row = approvals.find(registry_id);
  if (row == approvals.end())
    return std::nullopt;
  return *row;
}

/**
 * Эффективная редакция шаблона для кооператива.
 *
 * Утверждённая советом редакция, если строка утверждения есть; иначе текущая
 * редакция сети. Именно её пишут в подпись пайщика `soviet::sndagreement` и
 * `wallet::signagree`: подпись под редакцией, которую совет не утверждал,
 * после утверждения не вызвала бы переподписания.
 */
inline uint64_t get_effective_draft_version(eosio::name coopname, uint64_t registry_id) {
  auto approval = get_draft_approval(coopname, registry_id);
  if (approval.has_value())
    return approval->version;

  return get_scoped_draft_by_registry_or_fail(_draft, registry_id).version;
}
