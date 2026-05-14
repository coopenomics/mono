/**
 * @brief Поставщик акцептует консолидированную заявку (Story 4.5, p.mkt.supply).
 *
 * Без ledger2-операций (Locked Decision L10: batch — backend-only сущность,
 * on-chain действия per-Order). Для каждого order в batch'е переводит статус
 * active → accepted, фиксирует accepted_at и batch_hash для трассировки.
 *
 * Guards:
 *  - actor совпадает с order.offerer для всех orders (одна batch — один offerer).
 *  - Все orders в active.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::acceptbatch(eosio::name coopname,
                               eosio::name offerer,
                               checksum256 batch_hash,
                               std::vector<checksum256> order_hashes) {
  require_auth(coopname);
  eosio::check(!order_hashes.empty(), "acceptbatch: список order_hashes пуст");


  for (const auto& h : order_hashes) {
    auto o = Marketplace::get_order_by_hash_or_fail(coopname, h);
    eosio::check(o.offerer == offerer,
                 "acceptbatch: вы не поставщик одного из orders в batch'е");
    eosio::check(o.status == OrderStatus::ACTIVE,
                 "acceptbatch: один из orders не в active");

    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.status = OrderStatus::ACCEPTED;
      upd.batch_hash = batch_hash;
    });
  }
}
