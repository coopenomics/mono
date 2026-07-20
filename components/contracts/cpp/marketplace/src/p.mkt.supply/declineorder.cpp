/**
 * @brief Поставщик отказывается от одного Order'а до акцепта (Story 4.5, p.mkt.supply).
 *
 * Per-Order: o.mkt.unlock на total_cost (TRANSFER w.mkt.order → w.mkt.member —
 * резерв возвращается на членский «Стола заказов» заказчика) + статус active →
 * cancelled. Backend проходит циклом по orders соответствующего batch'а,
 * вызывая `declineorder` per Order — векторов order_hash нет.
 *
 * Guards:
 *  - Order существует и в статусе active.
 *  - actor == order.offerer.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::declineorder(eosio::name coopname,
                                eosio::name offerer,
                                checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer == offerer, "Вы не поставщик этого заказа");
  eosio::check(o.status == OrderStatus::ACTIVE,
               "Заказ уже не в активном статусе — отклонить нельзя");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNLOCK_ORDER,
                 o.total_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_decline_order_memo(o.id));

  // Членский взнос возвращается полностью (o.mkt.refund, requirement b6).
  Marketplace::refund_membership_fee_if_any(coopname, o);

  // Отказ поставщика — терминал жизненного цикла заказа: запись стирается
  // из RAM, история остаётся в журнале действий.
  Marketplace::erase_order(coopname, o.id);
}
