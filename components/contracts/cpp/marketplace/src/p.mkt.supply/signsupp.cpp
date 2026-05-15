/**
 * @brief Поставщик первой подписью на АПП приёмки фиксирует партию по одному
 * Order'у (Story 5.3/5.4, p.mkt.supply).
 *
 * Без ledger2-операций (имущество физически на складе, но юридически не
 * оприходовано до signchair). Per-Order: статус accepted → supply_prepared,
 * параметр `accept_braname` указывает приёмный КУ — куда поставщик сдаёт
 * партию. Документ acceptance_act_signsupp сохраняется (копия per Order
 * — допустимо для on-chain).
 *
 * Backend проходит циклом по orders соответствующего batch'а с одним и тем
 * же актом, вызывая `signsupp` per Order — это позволяет масштабировать
 * batch на любой размер без риска превысить лимит транзакции Antelope.
 *
 * Guards:
 *  - Order существует и в статусе accepted.
 *  - actor == order.offerer.
 *  - `accept_braname` существует в `branches[coopname]`.
 *  - verify_document_or_fail(act, {offerer}) — поставщик подписал.
 *  - Idempotency: повторный вызов запрещён (`is_empty_document(acceptance_act_signsupp)`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signsupp(eosio::name coopname,
                            eosio::name offerer,
                            checksum256 order_hash,
                            eosio::name accept_braname,
                            document2 act) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer == offerer, "Вы не поставщик этого заказа");
  eosio::check(o.status == OrderStatus::ACCEPTED,
               "Заказ не в статусе акцепта — подпись поставщика на акт приёмки невозможна");
  eosio::check(is_empty_document(o.acceptance_act_signsupp),
               "Подпись поставщика на акт приёмки уже зафиксирована");

  // КУ приёмки существует
  get_branch_or_fail(coopname, accept_braname);

  verify_document_or_fail(act, { offerer });

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::SUPPLY_PREPARED;
    upd.acceptance_act_signsupp = act;
    upd.accept_braname = accept_braname;
  });
}
