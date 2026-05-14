/**
 * @brief Председатель открывает выдачу первой подписью АПП-выдачи (Story 6.1, signiss1).
 *
 * Без ledger2-операций. Per-Order: статус accepted_to_coop → ready_to_receive;
 * issue_act_signiss1 сохраняется; ready_at = now(); нотификация заказчику —
 * post-effect в backend через ParserClient.
 *
 * Guards (L1):
 *  - actor == order.ku_chairman.
 *  - Order в accepted_to_coop.
 *  - verify_document_or_fail(act, {chairman}).
 *  - Idempotency: is_empty_document(issue_act_signiss1).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signiss1(eosio::name coopname,
                            eosio::name chairman,
                            checksum256 order_hash,
                            document2 act) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.ku_chairman == chairman,
               "signiss1: вы не председатель КУ выдачи этого Order'а");
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP,
               "signiss1: Order не в accepted_to_coop");
  eosio::check(is_empty_document(o.issue_act_signiss1),
               "signiss1: первая подпись АПП-выдачи уже зафиксирована (idempotency)");

  verify_document_or_fail(act, { chairman });

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::READY_TO_RECEIVE;
    upd.issue_act_signiss1 = act;
  });
}
