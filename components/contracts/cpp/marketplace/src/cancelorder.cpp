/**
 * @brief Заказчик отменяет заказ до акцепта поставщиком (Story 4.4, p.mkt.supply).
 *
 * Триггерит `o.mkt.unblk` на full `order.total_cost`. Сумма остаётся на
 * `w.mkt.member.available` заказчика — может быть потрачена на следующий
 * заказ программы либо выведена явным `o.mkt.recall` (отдельное действие).
 *
 * Guards:
 *  - Order существует.
 *  - actor == order.orderer.
 *  - Order в статусе active (до acceptbatch). После acceptbatch отмена
 *    запрещена — поставщик уже взял обязательство.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::cancelorder(eosio::name coopname,
                               eosio::name orderer,
                               checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer, "cancelorder: вы не заказчик этого Order'а");
  eosio::check(o.status == OrderStatus::ACTIVE,
               "cancelorder: нельзя отменить — заявка уже акцептована поставщиком");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNBLOCK_ON_CANCEL,
                 o.total_cost, orderer, o.hash, "cancelorder p.mkt.supply");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::CANCELLED;
    upd.cancelled_at = now;
  });
}
