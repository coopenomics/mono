/**
 * @brief Lazy-выплата поставщику по одному Order'у (E11 техдолг 598-16,
 * Locked Decision L12, p.mkt.supply).
 *
 * Выполняется после фактического подтверждения кассиром банковского перевода
 * поставщику. До этого момента приёмка уже отражена (`signchair` →
 * `o.mkt.purch`, Дт 10 / Кт 86), но обязательство по оплате на счёте 86
 * остаётся открытым — оно закрывается этим action'ом:
 *
 *  - Ledger2::apply(o.mkt.payout, total_cost, …, hash=order.hash) — Дт 86 / Кт 51.
 *
 * Per-Order; backend проходит циклом по orders batch'а по факту подтверждения
 * каждой выплаты кассиром. Статус Order'а не меняется (выплата происходит
 * параллельно с дальнейшими шагами выдачи); защита от двойного списания —
 * через `order.payout_done`.
 *
 * Guards:
 *  - Order существует, приёмка уже произведена (`status` ∈ accepted_to_coop /
 *    ready_to_receive / received).
 *  - `order.payout_done` ещё `false`.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::payout(eosio::name coopname, checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP ||
               o.status == OrderStatus::READY_TO_RECEIVE ||
               o.status == OrderStatus::RECEIVED,
               "Выплата возможна только после приёмки имущества кооперативом");
  eosio::check(!o.payout_done, "Выплата по заказу уже выполнена");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::PAY_SUPPLIER,
                 o.total_cost, o.offerer, o.hash,
                 Marketplace::Memo::get_pay_supplier_memo(o.id));

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_done = true;
  });
}
