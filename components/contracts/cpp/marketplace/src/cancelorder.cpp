/**
 * @brief Заказчик отменяет заказ до акцепта поставщиком (Story 4.4, p.mkt.supply).
 *
 * Триггерит `o.mkt.unblk` на full `order.total_cost`. Сумма остаётся на
 * `w.mkt.member.available` заказчика — может быть потрачена на следующий
 * заказ программы либо выведена явным `o.mkt.recall` (отдельное действие).
 *
 * Guards (из p.mkt.supply.standard.yaml):
 *  - Order ещё не вошёл в acceptedbatch (status == active).
 *  - actor совпадает с order.orderer.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::cancelorder(eosio::name coopname,
                               eosio::name orderer,
                               checksum256 order_hash) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: cancelorder ещё не реализован");
}
