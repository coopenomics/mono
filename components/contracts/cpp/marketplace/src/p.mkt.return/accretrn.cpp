/**
 * @brief Председатель принимает гарантийный возврат на очном осмотре (Story 7.4, p.mkt.return).
 *
 * Композитная транзакция (атомарно в одной Antelope tx):
 *  - Ledger2::apply(o.mkt.return,  fact_cost, orderer, hash=request.hash)  — Дт 91 / Кт 86, ISSUE w.mkt.member.
 *  - Ledger2::apply(o.mkt.return2, fact_cost, orderer, hash=request.hash)  — Дт 10 / Кт 91, NONE.
 *
 * Compensating forward, не revert (Locked Decision L3 — AR14): новое событие в
 * journal с прикладным полем `original_consume_op_id` (заполняется backend'ом
 * в submretrn) для трассировки. Исходные o.mkt.consum / o.mkt.consum2 в
 * журнале НЕ модифицируются.
 *
 * Status: approved_for_visit → return_accepted (final). Имущество возвращается
 * на склад КУ; средства восстанавливаются на w.mkt.member.available заказчика.
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == approved_for_visit.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::accretrn(eosio::name coopname,
                            eosio::name chairman,
                            checksum256 request_hash,
                            document2 decision) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.ku_chairman == chairman,
               "accretrn: вы не председатель КУ выдачи");
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "accretrn: заявление не в approved_for_visit");

  if (!is_empty_document(decision)) {
    verify_document_or_fail(decision, { chairman });
  }

  const std::string memo = "accretrn p.mkt.return (compensating forward)";

  // Композитная пара return + return2
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RETURN_BY_MEMBER,
                 r.fact_cost, r.orderer, r.hash, memo);
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RETURN_TRANSIT_CLOSE,
                 r.fact_cost, r.orderer, r.hash, memo);

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status         = ReturnStatus::RETURN_ACCEPTED;
    upd.decision_visit = decision;
  });
}
