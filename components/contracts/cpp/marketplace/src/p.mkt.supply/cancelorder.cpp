/**
 * @brief Заказчик отменяет заказ до акцепта поставщиком (Story 4.4, p.mkt.supply).
 *
 * Триггерит `o.mkt.unlock` на full `order.total_cost` — TRANSFER w.mkt.order →
 * w.mkt.member (снятие резерва). Сумма возвращается на членский «Стола заказов»
 * `w.mkt.member.available` заказчика — остаётся в программе под следующие заказы.
 *
 * Guards:
 *  - Order существует.
 *  - actor == order.orderer.
 *  - Order в статусе active (до acceptorder). После acceptorder отмена
 *    запрещена — поставщик уже взял обязательство.
 *  - Исключение — заказ из остатка кооператива (offerer == coopname,
 *    см. stockorder): он рождается сразу в acceptcoop и отменяется в этом
 *    статусе — до первой подписи акта выдачи оператор может откатить и
 *    переформировать докладку (requirement 76, решение 11). После signiss1
 *    статус уходит в ready_to_receive и отмена закрыта.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::cancelorder(eosio::name coopname,
                               eosio::name orderer,
                               checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer, "Вы не заказчик этого заказа");
  const bool is_stock_order = (o.offerer == coopname);
  if (is_stock_order) {
    eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP,
                 "Нельзя отменить заказ из остатка: выдача уже открыта");
  } else {
    eosio::check(o.status == OrderStatus::ACTIVE,
                 "Нельзя отменить заказ: он уже акцептован поставщиком");
  }

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNLOCK_ORDER,
                 o.total_cost, orderer, o.hash,
                 Marketplace::Memo::get_cancel_order_memo(o.id));

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::CANCELLED;
  });
}
