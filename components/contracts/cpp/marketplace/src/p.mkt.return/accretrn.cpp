/**
 * @brief Председатель принимает гарантийный возврат на очном осмотре (Story 7.4, p.mkt.return).
 *
 *  - Ledger2::apply(o.mkt.return, fact_cost, orderer, hash=request.hash)
 *    — ISSUE w.wal.member, Дт 10 / Кт 86. Восстановление средств на универсальном
 *    членском заказчика + возврат имущества на склад через целевое финансирование,
 *    одной операцией без транзита 91.
 *
 * Compensating forward, не revert (Locked Decision L3 — AR14): новое событие в
 * journal с прикладным полем `original_consume_op_id` (заполняется backend'ом
 * в submretrn) для трассировки. Исходная o.mkt.consum в журнале НЕ модифицируется.
 *
 * Status: approved_for_visit → return_accepted (final). Имущество возвращается
 * на склад КУ; средства восстанавливаются на w.wal.member.available заказчика.
 *
 * Guards:
 *  - Подписант (`signer`) авторизован для указанного КУ (`braname`).
 *  - return_request.status == approved_for_visit.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::accretrn(eosio::name coopname,
                            eosio::name signer,
                            eosio::name braname,
                            checksum256 request_hash,
                            document2 decision) {
  require_auth(coopname);

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать возвраты данного кооперативного участка");

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "Заявление не одобрено для очного осмотра");

  if (!is_empty_document(decision)) {
    verify_document_or_fail(decision, { signer });
  }

  // o.mkt.return: ISSUE w.wal.member, Дт 10 / Кт 86 (одна операция без транзита 91)
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RETURN_BY_MEMBER,
                 r.fact_cost, r.orderer, r.hash,
                 Marketplace::Memo::get_return_by_member_memo(r.id, r.original_order_id));

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status         = ReturnStatus::RETURN_ACCEPTED;
    upd.decision_visit = decision;
  });
}
