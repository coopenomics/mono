/**
 * @brief Поставщик отказывается от консолидированной заявки (Story 4.5, p.mkt.supply).
 *
 * Для каждого order: o.mkt.unblk на total_cost + статус active → cancelled.
 * Договорные санкции при отказе — вне этого процесса (по регламенту кооператива).
 *
 * Guards:
 *  - actor == offerer для всех orders в batch'е.
 *  - Все orders в active (до acceptbatch).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::declinebatch(eosio::name coopname,
                                eosio::name offerer,
                                checksum256 batch_hash,
                                std::vector<checksum256> order_hashes) {
  require_auth(coopname);
  eosio::check(!order_hashes.empty(), "declinebatch: список order_hashes пуст");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  for (const auto& h : order_hashes) {
    auto o = Marketplace::get_order_by_hash_or_fail(coopname, h);
    eosio::check(o.offerer == offerer,
                 "declinebatch: вы не поставщик одного из orders в batch'е");
    eosio::check(o.status == OrderStatus::ACTIVE,
                 "declinebatch: один из orders не в active (поставщик уже акцептовал)");

    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNBLOCK_ON_CANCEL,
                   o.total_cost, o.orderer, o.hash, "declinebatch p.mkt.supply");

    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.status = OrderStatus::CANCELLED;
      upd.cancelled_at = now;
      upd.batch_hash = batch_hash;
    });
  }
}
