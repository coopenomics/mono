/**
 * @brief Поставщик акцептует один Order (Story 4.5, p.mkt.supply).
 *
 * Без ledger2-операций — статус active → accepted. Backend проходит циклом
 * по orders соответствующего batch'а, вызывая `acceptorder` per Order
 * (контракт не принимает векторов order_hash — единичные транзакции
 * масштабируются на любой размер batch'а).
 *
 * После акцепта поставщик считается обязанным доставить партию: отдельная
 * подпись «готов отгрузить» (бывший prepship) удалена из процесса —
 * следующий шаг сразу signsupp с актом приёмки.
 *
 * Guards:
 *  - Order существует и в статусе active.
 *  - actor == order.offerer.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::acceptorder(eosio::name coopname,
                               eosio::name offerer,
                               checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer == offerer, "Вы не поставщик этого заказа");
  eosio::check(o.status == OrderStatus::ACTIVE,
               "Заказ уже не в активном статусе — акцептовать нельзя");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::ACCEPTED;
  });
}
