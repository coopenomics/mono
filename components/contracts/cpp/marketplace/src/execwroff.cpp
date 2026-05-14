/**
 * @brief Совет исполняет списание скоропорта (Story 8.3, p.mkt.wroff).
 *
 * Per-item композитная транзакция (атомарно):
 *  - Ledger2::apply(o.mkt.wroff,  item.amount, …, hash=proposal.hash) — Дт 91 / Кт 10.
 *  - Ledger2::apply(o.mkt.wroff2, item.amount, …, hash=proposal.hash) — Дт 86 / Кт 91.
 *
 * Применяется по каждой позиции в proposal.items — может быть несколько
 * последовательных пар в одной транзакции execwroff.
 *
 * Status: draft → executed (final). protocol сохраняется.
 *
 * Guards:
 *  - actor == proposal.decided_by или председатель / правомочное лицо
 *    (фактическая проверка через soviet::decisions ID — backend pre-validates).
 *  - proposal.status == draft.
 *  - verify_document_or_fail(protocol, {council_members}).
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 6): полная реализация.
 */
void marketplace::execwroff(eosio::name coopname,
                             eosio::name decided_by,
                             checksum256 proposal_hash,
                             document2 protocol) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 6: execwroff ещё не реализован");
}
