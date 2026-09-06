/**
 * @brief Заказчик отменяет заказ / отказывается от получения позиции
 *        (Story 4.4 + удержание при отказе, p.mkt.supply).
 *
 * Граница удержания — акцепт поставщиком (acceptorder). До акцепта поставщик
 * ещё не взял обязательство и ничего не везёт — отмена бесплатна (полный
 * возврат резерва и членского взноса). После акцепта поставщик уже принял
 * заявку и доставляет имущество, кооператив несёт риск его оплаты — отказ
 * пайщика удерживает 50% (тела заказа и взноса) в общий кошелёк КУ; имущество
 * остаётся на складе КУ, вторая половина возвращается пайщику.
 *
 * Guards:
 *  - Order существует, actor == order.orderer.
 *  - active                                   → бесплатно (полный возврат).
 *  - accepted / supplyprep / acceptcoop       → удержание 50% (после акцепта).
 *  - readyrecv / received                     → закрыто (акт выдачи уже открыт).
 *  - Заказ из остатка кооператива (offerer == coopname, см. stockorder):
 *    поставщика и его риска нет — отмена бесплатна в acceptcoop до первой
 *    подписи акта выдачи (requirement 76, решение 11); после readyissue закрыта.
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
    // Остаток кооператива: нет поставщика — отмена бесплатна до выдачи.
    eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP ||
                 o.status == OrderStatus::READY_TO_RECEIVE,
                 "Нельзя отменить заказ из остатка: выдача уже начата");
    Marketplace::refund_order_full(coopname, o);
  } else if (o.status == OrderStatus::ACTIVE) {
    // До акцепта поставщиком — бесплатно.
    Marketplace::refund_order_full(coopname, o);
  } else if (o.status == OrderStatus::ACCEPTED ||
             o.status == OrderStatus::SUPPLY_PREPARED ||
             o.status == OrderStatus::ACCEPTED_TO_COOP) {
    // После акцепта поставщиком — удержание 50%.
    Marketplace::retain_refusal_penalty(coopname, o);
  } else {
    eosio::check(false, "Нельзя отменить заказ: акт выдачи уже открыт");
  }

  // Отмена / отказ — терминал жизненного цикла заказа: запись стирается из RAM,
  // история остаётся в журнале действий.
  Marketplace::erase_order(coopname, o.id);
}
