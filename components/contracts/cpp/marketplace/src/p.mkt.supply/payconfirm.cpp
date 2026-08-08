/**
 * @brief Callback от gateway о фактическом подтверждении исходящей выплаты
 * поставщику (E11 техдолг 598-16, Locked Decision L12, p.mkt.supply).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир в админке подтвердил реальный банковский перевод.
 * Здесь — единственное место, где применяется бухгалтерская проводка
 * выплаты:
 *
 *  - Ledger2::apply(o.mkt.payout, fact_cost, …, hash=order.hash) — Дт 86 / Кт 51.
 *
 * Сумма — `o.fact_cost` (фактически принятое после отбраковки на приёмке), а не
 * исходный `o.total_cost`: проводка должна совпадать с приходованием имущества
 * (Кт 86 = fact_cost из signchair) и с реальной суммой банковского перевода.
 *
 * `outcome_hash` приходит из gateway и равен `order.hash` (так его задал
 * marketplace::payout). Поиск Order'а — по индексу `byhash`.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта.
 *  - Order найден по `outcome_hash`.
 *  - `payout_status == PENDING` — на NONE/COMPLETED/DECLINED callback не ждём.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::payconfirm(eosio::name coopname, checksum256 outcome_hash) {
  require_auth(_gateway);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, outcome_hash,
             "Order не найден по outcome_hash из callback'а gateway");
  eosio::check(o.payout_status == OrderPayoutStatus::PENDING,
               "Callback gateway::outcomplete получен на Order не в статусе ожидания выплаты");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::PAY_SUPPLIER,
                 o.fact_cost, o.offerer, o.hash,
                 Marketplace::Memo::get_pay_supplier_memo(o.id));

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::COMPLETED;
    upd.payout_decline_reason.clear();
  });
}
