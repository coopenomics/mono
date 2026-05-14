/**
 * @brief Совет исполняет списание скоропорта (Story 8.3, p.mkt.wroff).
 *
 * Per-item композитная транзакция (атомарно):
 *  - Ledger2::apply(o.mkt.wroff,  item.amount, …, hash=proposal.hash) — Дт 91 / Кт 10.
 *  - Ledger2::apply(o.mkt.wroff2, item.amount, …, hash=proposal.hash) — Дт 86 / Кт 91.
 *
 * Применяется по каждой позиции в proposal.items — серия пар
 * (wroff + wroff2) последовательно в одной транзакции execwroff.
 *
 * Все операции с одним process_hash = proposal.hash — backend через
 * `getProcess(proposal.hash)` соберёт полную трассировку процесса.
 *
 * Status: proposed (= "draft") → executed (final). protocol сохраняется.
 *
 * Guards:
 *  - proposal.status == proposed.
 *  - verify_document_or_fail(protocol, {decided_by}) — proxy для подписи совета.
 *    Реальная сверка с протоколом совета выполняется backend pre-validation
 *    через soviet::decisions; здесь — sanity check, что подпись decided_by на
 *    протоколе валидна.
 *
 * @note Авторизация actor'а (decided_by — председатель совета или
 *       уполномоченное лицо) проверяется на стороне backend через
 *       soviet::decisions; контракт верит coopname permission.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::execwroff(eosio::name coopname,
                             eosio::name decided_by,
                             checksum256 proposal_hash,
                             document2 protocol) {
  require_auth(coopname);

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, proposal_hash);
  eosio::check(p.status == WroffStatus::PROPOSED,
               "execwroff: проект не в статусе proposed");

  verify_document_or_fail(protocol, { decided_by });

  const std::string memo = "execwroff p.mkt.wroff";

  // Per-item композитная пара
  for (const auto& item : p.items) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::WRITE_OFF_PERISHABLE,
                   item.amount, item.ku_chairman, p.hash, memo);
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::WRITE_OFF_TRANSIT_CLOSE,
                   item.amount, item.ku_chairman, p.hash, memo);
  }

  Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
    upd.status      = WroffStatus::EXECUTED;
    upd.decided_by  = decided_by;
    upd.protocol    = protocol;
  });
}
