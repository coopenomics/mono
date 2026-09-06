/**
 * @brief Поставщик отказывается от одного Order'а (Story 4.5 + отказ в приёмке,
 *        p.mkt.supply).
 *
 * Два случая, оба со стороны поставщика и оба без штрафа — полный возврат
 * резерва и членского взноса заказчику (вина не его):
 *  1. До акцепта (active) — поставщик не берёт заявку в работу.
 *  2. Отказ в приёмке (accepted / supply_prepared) — поставщик привёз
 *     некондицию; кооператив не принимает позицию (ноль единиц в факт),
 *     поставщик подтверждает отмену поставки этой позиции и забирает имущество
 *     обратно. Имущество ещё не оприходовано на склад (purch на закрывающей
 *     подписи приёмки) и поставщик ещё не оплачен — клоубэка нет.
 *
 * Per-Order: o.mkt.unlock на total_cost (TRANSFER w.mkt.order → w.mkt.share —
 * паевой резерв возвращается на свободный паевой «Стола заказов» заказчика) + полный возврат
 * взноса + erase. Backend проходит циклом по неотмеченным в приёмке orders —
 * векторов order_hash нет.
 *
 * Guards:
 *  - Order существует, actor == order.offerer.
 *  - Статус active / accepted / supply_prepared (до оприходования имущества).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::declineorder(eosio::name coopname,
                                eosio::name offerer,
                                checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer == offerer, "Вы не поставщик этого заказа");
  eosio::check(o.status == OrderStatus::ACTIVE ||
               o.status == OrderStatus::ACCEPTED ||
               o.status == OrderStatus::SUPPLY_PREPARED,
               "Заказ нельзя отклонить: имущество уже принято кооперативом");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNLOCK_ORDER,
                 processes::marketplace::SUPPLY,
                 o.total_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_decline_order_memo(o.id));

  // Членский взнос возвращается полностью (o.mkt.refund, requirement b6).
  Marketplace::refund_membership_fee_if_any(coopname, o);

  // Отказ поставщика — терминал жизненного цикла заказа: запись стирается
  // из RAM, история остаётся в журнале действий.
  Marketplace::erase_order(coopname, o.id);
}
