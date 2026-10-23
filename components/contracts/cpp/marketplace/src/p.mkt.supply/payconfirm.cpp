/**
 * @brief Callback от gateway о фактическом подтверждении исходящей выплаты
 * поставщику (E11 техдолг 598-16, Locked Decision L12, p.mkt.supply).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир в админке подтвердил реальный банковский перевод.
 * Здесь — единственное место, где применяется бухгалтерская проводка
 * выплаты:
 *
 *  - Ledger2::apply(o.mkt.payout, accepted_cost − payout_withheld, …,
 *    hash=order.hash) — Дт 76 / Кт 51.
 *
 * Сумма — принятая стоимость по акту приёмки за вычетом удержанного долга:
 * ровно та, что `payout` зарегистрировал в gateway и что кассир перевёл в
 * банк. `fact_cost` здесь не годится — к моменту подтверждения его могло
 * перезаписать заявление о выдаче, и проводка разошлась бы с переводом, а
 * остаток долга навсегда завис бы на счёте 76 (задача 99D-14).
 *
 * Удержанный долг (o.mkt.deduct) здесь не гасится: он погашен при инициации
 * выплаты в `payout` — иначе вторая ожидающая выплата тому же поставщику
 * удержала бы тот же долг повторно (задача 99D-15).
 *
 * `outcome_hash` приходит из gateway и равен `order.hash` (так его задал
 * marketplace::payout). Поиск Order'а — по индексу `byhash`.
 *
 * Заказ в статусе `refused` (пайщик отказался после приёмки) жил только ради
 * этого расчёта: после проводки он стирается из RAM, история — в журнале
 * действий. Отказ обратного вызова откатил бы подтверждение кассира целиком
 * (gateway шлёт его инлайн), поэтому заказ до этого шага стирать нельзя.
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

  const eosio::asset withheld = Marketplace::get_payout_withheld(o);
  const eosio::asset paid = Marketplace::get_accepted_cost(o) - withheld;
  eosio::check(paid.amount > 0, "Выплата поставщику после удержания долга пуста");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::PAY_SUPPLIER,
                 processes::marketplace::SUPPLY,
                 paid, o.offerer, o.hash,
                 Marketplace::Memo::get_pay_supplier_memo(o.id));

  if (o.status == OrderStatus::REFUSED) {
    Marketplace::erase_order(coopname, o.id);
    return;
  }

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::COMPLETED;
    upd.payout_decline_reason.clear();
  });
}
