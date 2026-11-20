/**
 * @brief Заказ оплаченного пакета закрывается: Дт 76 / Кт 51 на заказ
 * (p.mkt.supply).
 *
 * После подтверждения кассира (`payconfirm`, пакет paid) узел закрывает заказы
 * пакета по одному. Здесь применяется o.mkt.payout на принятую стоимость
 * `accepted_cost` за вычетом удержания (`payout_withheld`) — ту же сумму,
 * которую `addpayout` прибавил к пакету. Заказ после отказа пайщика
 * стирается, иначе `payout_status` переходит pending → completed. Последний
 * закрытый заказ стирает строку пакета.
 *
 * Guards: заказ ждёт выплаты (pending) и его пакет оплачен (paid).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::closepayout(eosio::name coopname, checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.payout_status == OrderPayoutStatus::PENDING,
               "MARKETPLACE_PAYOUT_NOT_PENDING: Заказ не ждёт выплаты поставщику");
  auto p = Marketplace::get_payout_by_hash_or_fail(coopname, Marketplace::get_payout_hash(o));
  eosio::check(p.status == PayoutStatus::PAID,
               "MARKETPLACE_PAYOUT_NOT_PAID: Пакет выплаты заказа ещё не оплачен кассиром");

  const eosio::asset paid = Marketplace::get_accepted_cost(o) - Marketplace::get_payout_withheld(o);
  eosio::check(paid.amount > 0, "MARKETPLACE_PAYOUT_EMPTY: Выплата по заказу после удержания долга пуста");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::PAY_SUPPLIER,
                 processes::marketplace::SUPPLY,
                 paid, o.offerer, o.hash,
                 Marketplace::Memo::get_pay_supplier_memo(o.id));

  Marketplace::detach_order_from_payout(coopname, p);

  if (o.status == OrderStatus::REFUSED) {
    Marketplace::erase_order(coopname, o.id);
    return;
  }
  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::COMPLETED;
    upd.payout_decline_reason.clear();
    upd.payout_hash.emplace(checksum256());
  });
}
