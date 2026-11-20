/**
 * @brief Заказ отклонённого пакета возвращается в ожидание выплаты
 * (p.mkt.supply).
 *
 * После отказа кассира (`paydecline`, пакет declined) узел возвращает заказы
 * пакета по одному: `payout_status` pending → declined, причина отказа
 * переносится в заказ. Удержанный долг остаётся в `payout_withheld` и при
 * следующем включении в пакет не удерживается повторно. Последний заказ
 * стирает строку пакета.
 *
 * Guards: заказ ждёт выплаты (pending) и его пакет отклонён (declined).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::releasepay(eosio::name coopname, checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.payout_status == OrderPayoutStatus::PENDING,
               "MARKETPLACE_PAYOUT_NOT_PENDING: Заказ не ждёт выплаты поставщику");
  auto p = Marketplace::get_payout_by_hash_or_fail(coopname, Marketplace::get_payout_hash(o));
  eosio::check(p.status == PayoutStatus::DECLINED,
               "MARKETPLACE_PAYOUT_NOT_DECLINED: Пакет выплаты заказа не отклонён кассиром");

  Marketplace::detach_order_from_payout(coopname, p);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::DECLINED;
    upd.payout_decline_reason = p.decline_reason;
    upd.payout_hash.emplace(checksum256());
  });
}
