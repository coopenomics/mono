/**
 * @brief Backend закрывает цикл отсечки заявок поставщика (Story 4.3, p.mkt.supply).
 *
 * threshold_reached == true: orders остаются в active — backend сам формирует
 *   batch и отправляет поставщику; on-chain side-effect отсутствует.
 * threshold_reached == false: для каждого order: o.mkt.unblk на total_cost +
 *   статус active → cancelled. Резерв снимается, средства возвращаются
 *   на w.mkt.member.available заказчиков.
 *
 * Guards:
 *  - actor backend (auth coopname).
 *  - Все order_hashes принадлежат одному cycle/batch_hash (контракт записывает
 *    batch_hash в order при отмене для трассировки).
 *  - Все orders в active.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::expirecycle(eosio::name coopname,
                               checksum256 batch_hash,
                               std::vector<checksum256> order_hashes,
                               bool threshold_reached) {
  require_auth(coopname);
  eosio::check(!order_hashes.empty(), "expirecycle: список order_hashes пуст");

  if (threshold_reached) {
    // No-op on-chain; backend сам переведёт batch в pending_supplier_accept
    // через acceptbatch. Контракт только фиксирует факт закрытия цикла —
    // через ParserClient backend увидит сам action expirecycle с этим batch_hash.
    return;
  }

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  for (const auto& h : order_hashes) {
    auto o = Marketplace::get_order_by_hash_or_fail(coopname, h);
    eosio::check(o.status == OrderStatus::ACTIVE,
                 "expirecycle: один из orders не в active");

    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNBLOCK_ON_CANCEL,
                   o.total_cost, o.orderer, o.hash, "expirecycle p.mkt.supply");

    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.status = OrderStatus::CANCELLED;
      upd.cancelled_at = now;
      upd.batch_hash = batch_hash;     // фиксируем для трассировки
    });
  }
}
