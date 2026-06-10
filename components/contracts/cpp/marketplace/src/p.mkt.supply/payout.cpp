/**
 * @brief Инициация исходящей выплаты поставщику по одному Order'у через gateway
 * (E11 техдолг 598-16, Locked Decision L12, p.mkt.supply).
 *
 * Backend дёргает это действие, когда кассир в админке отметил готовность
 * проводить выплату поставщику. Действие НЕ применяет ledger2 — оно лишь
 * inline-вызовом регистрирует в gateway::outcomes запись типа «исходящий
 * платёж» со статусом pending и привязанным callback'ом на marketplace. Сам
 * Дт 86 / Кт 51 произойдёт уже в callback'е `payconfirm` после фактического
 * банковского перевода (gateway::outcomplete вызывает кассир через свой
 * стол), либо отменится в `paydecline` (gateway::outdecline).
 *
 * Inline-вызов: `gateway::createoutpay` с `callback_contract = _marketplace`,
 * `confirm_callback = "payconfirm"_n`, `decline_callback = "paydecline"_n`,
 * `outcome_hash = order.hash` (уникальность гарантирована индексом orders).
 *
 * Status Order'а не меняется (выплата может идти параллельно шагам выдачи).
 * payout_status переходит NONE/DECLINED → PENDING; declined-кейс — повторная
 * попытка после исправления реквизитов (gateway-запись была стёрта на outdecline).
 *
 * Guards:
 *  - Order существует и приёмка завершена (статус ∈ accepted_to_coop /
 *    ready_to_receive / received).
 *  - payout_status ∈ { NONE, DECLINED } — нельзя инициировать выплату поверх
 *    pending или completed.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::payout(eosio::name coopname, checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer != coopname,
               "По заказу из остатка кооператива выплата поставщику не предусмотрена: имущество уже оплачено при первичной приёмке");
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP ||
               o.status == OrderStatus::READY_TO_RECEIVE ||
               o.status == OrderStatus::RECEIVED,
               "Выплата возможна только после приёмки имущества кооперативом");
  eosio::check(o.payout_status == OrderPayoutStatus::NONE ||
               o.payout_status == OrderPayoutStatus::DECLINED,
               "Выплата уже инициирована либо завершена");

  // Регистрация исходящего платежа в gateway. Сам Дт 86 / Кт 51 произойдёт
  // в callback'е `payconfirm` от gateway после действия кассира.
  Gateway::create_outcome(_marketplace, coopname, o.offerer, o.hash, o.total_cost,
                          _marketplace, "payconfirm"_n, "paydecline"_n);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::PENDING;
    upd.payout_decline_reason.clear();  // на случай повторной инициации после DECLINED
  });
}
