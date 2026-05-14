/**
 * @brief Поставщик первой подписью на АПП приёмки подтверждает передачу партии (Story 5.3/5.4).
 *
 * Без ledger2-операций (имущество физически на складе, но юридически не оприходовано
 * до signchair). Per-Order: статус ship_ready → supply_prepared, документ
 * acceptance_act_signsupp сохраняется (копия per order — допустимо для on-chain).
 *
 * Guards (L1):
 *  - actor == offerer для всех orders.
 *  - Все orders в ship_ready.
 *  - verify_document_or_fail(act, {offerer}) — поставщик подписал.
 *  - Idempotency: повторный вызов запрещён (`is_empty_document(acceptance_act_signsupp)` check).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signsupp(eosio::name coopname,
                            eosio::name offerer,
                            checksum256 batch_hash,
                            std::vector<checksum256> order_hashes,
                            document2 act) {
  require_auth(coopname);
  eosio::check(!order_hashes.empty(), "signsupp: список order_hashes пуст");

  verify_document_or_fail(act, { offerer });

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  for (const auto& h : order_hashes) {
    auto o = Marketplace::get_order_by_hash_or_fail(coopname, h);
    eosio::check(o.offerer == offerer,
                 "signsupp: вы не поставщик одного из orders в batch'е");
    eosio::check(o.status == OrderStatus::SHIP_READY,
                 "signsupp: один из orders не в ship_ready");
    eosio::check(is_empty_document(o.acceptance_act_signsupp),
                 "signsupp: подпись поставщика на АПП приёмки уже зафиксирована (idempotency)");

    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.status = OrderStatus::SUPPLY_PREPARED;
      upd.acceptance_act_signsupp = act;
      upd.shipped_at = now;
    });
  }
}
