/**
 * @brief Callback от gateway об отклонении исходящей выплаты поставщику
 * (E11 техдолг 598-16, Locked Decision L12, p.mkt.supply).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outdecline` —
 * кассир отметил, что банковский перевод не прошёл (нет реквизитов,
 * платёж отменён банком, ошибка ввода). Бухгалтерия не двигается —
 * обязательство Кт 86 перед поставщиком остаётся открытым. Backend может
 * повторно вызвать `marketplace::payout` после исправления реквизитов;
 * gateway-запись по этому outcome_hash уже стёрта на outdecline, поэтому
 * повторная инициация проходит штатно (см. payout-гард `payout_status ∈ {
 * NONE, DECLINED }`).
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта.
 *  - Order найден по `outcome_hash`.
 *  - `payout_status == PENDING`.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::paydecline(eosio::name coopname, checksum256 outcome_hash, std::string reason) {
  require_auth(_gateway);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, outcome_hash,
             "Order не найден по outcome_hash из callback'а gateway");
  eosio::check(o.payout_status == OrderPayoutStatus::PENDING,
               "Callback gateway::outdecline получен на Order не в статусе ожидания выплаты");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::DECLINED;
    upd.payout_decline_reason = reason;
  });
}
