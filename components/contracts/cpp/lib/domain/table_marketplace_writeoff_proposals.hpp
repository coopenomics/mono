#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "../core/document.hpp"
#include "../core/utils.hpp"

namespace Marketplace {

using namespace eosio;

/**
 * @brief Статусы проекта решения совета о списании скоропорта (процесс p.mkt.wroff).
 *
 * Граф: ∅ → draft → executed (final, ledger2-операции применены)
 *                 → rejected (final, без ledger2-операций)
 *
 * Источник правды — `p.mkt.wroff.standard.yaml` секция `states:`.
 */
namespace WroffStatus {
  // Имя константы PROPOSED (а не DRAFT) — конфликт с макросом
  // DRAFT="draft" из lib/consts.hpp; on-chain строка осталась "draft"_n,
  // как в p.mkt.wroff.standard.yaml.
  inline constexpr eosio::name PROPOSED = "draft"_n;
  inline constexpr eosio::name EXECUTED = "executed"_n;
  inline constexpr eosio::name REJECTED = "rejected"_n;
}

/**
 * @brief Позиция к списанию в составе writeoff_proposal.
 *
 * Может ссылаться:
 *  - на конкретный Order (если позиция «не выдана первичному заказчику») —
 *    `source_order_id` != 0;
 *  - на излишек в результате signiss2 fact > ordered + остаток на складе —
 *    `source_order_id` == 0, аналитика только через `braname` + `meta`;
 *  - на возвращённое имущество из p.mkt.return — `source_order_id` ссылка
 *    через original Order, через который имущество физически вернулось.
 *
 * `braname` — кооперативный участок (склад) источник списания. Пер-КУ
 * аналитика счёта 10. Подпись протокола проверяется через
 * `Branch::is_user_authorized(coopname, braname, signer)` — председатель
 * соответствующего КУ может делегировать подпись доверенному лицу.
 *
 * `amount` — сумма к списанию по этой позиции (Дт 91 / Кт 10 в части 1
 * и Дт 86 / Кт 91 в части 2 — обе в одной транзакции execwroff).
 *
 * `meta` — произвольная строка для UI / отчёта (название позиции, причина);
 * не валидируется контрактом.
 *
 * `executed` — true после успешного списания этой позиции (см. execwroff
 * per-item action). Когда все items в proposal.items имеют executed=true,
 * статус proposal автоматически переходит в EXECUTED.
 */
struct wroff_item {
  uint64_t source_order_id = 0;                               ///< 0 если списание из складского остатка без привязки к order'у
  eosio::name braname;                                        ///< КУ-склад источник списания
  eosio::asset amount = asset(0, _root_govern_symbol);
  std::string meta;
  bool executed = false;                                      ///< true после execwroff(proposal_hash, item_index)
};

/**
 * @brief On-chain Проект решения совета о списании скоропорта — анкер процесса p.mkt.wroff.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `proposal.hash` — этот hash используется как `process_hash` во всех
 * ledger2-операциях процесса (WROFF + WROFF2 — по паре per-item).
 *
 * `items` — vector<wroff_item> позиций к списанию; на execwroff контракт
 * последовательно вызывает `Ledger2::apply(o.mkt.wroff, item.amount, …)` +
 * `Ledger2::apply(o.mkt.wroff2, item.amount, …)` для каждой позиции в
 * одной транзакции Antelope.
 *
 * `protocol` — document2 решения совета (signed_by: council_members).
 * Подпись — через стандартный sov.decision-протокол (см. p.mkt.wroff.standard.yaml
 * секция documents).
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] writeoff_proposal {
  uint64_t id;
  checksum256 hash;                                           ///< process_hash для p.mkt.wroff
  eosio::name coopname;
  eosio::name proposed_by;                                    ///< backend / админ — инициатор propwroff
  eosio::name decided_by;                                     ///< actor execwroff/declwroff (председатель / совет)

  std::vector<wroff_item> items;
  eosio::asset total_amount = asset(0, _root_govern_symbol);  ///< Σ items.amount (для UI / отчёта)

  eosio::name status = WroffStatus::PROPOSED;
  document2 protocol;                                         ///< протокол решения совета (для execwroff)
  std::string reject_reason;                                  ///< причина отклонения (для declwroff)

  // Timestamp'ы propwroff/execwroff/declwroff — на бэкенде из blockchain_actions[at].

  uint64_t primary_key()  const { return id; }
  checksum256 by_hash()   const { return hash; }
  uint64_t by_status()    const { return status.value; }
};

typedef eosio::multi_index<
    "wroffprops"_n, writeoff_proposal,
    eosio::indexed_by<"byhash"_n,     eosio::const_mem_fun<writeoff_proposal, checksum256, &writeoff_proposal::by_hash>>,
    eosio::indexed_by<"bystatus"_n,   eosio::const_mem_fun<writeoff_proposal, uint64_t,    &writeoff_proposal::by_status>>>
    writeoff_proposals_index;

} // namespace Marketplace
