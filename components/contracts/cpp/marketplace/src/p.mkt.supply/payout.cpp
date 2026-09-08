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
 * Сумма выплаты — `o.fact_cost` (фактически принятое после приёмки), а НЕ
 * `o.total_cost` (исходный заказ): при отбраковке части поставки на приёмке
 * (signchair снизил факт) кооператив должен поставщику ровно принятое.
 * fact_cost зафиксирован на приёмке (статус-гард ниже гарантирует, что приёмка
 * уже прошла), совпадает с приходованием имущества Кт 86 и с суммой платежа в
 * реестре платежей кооператива.
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

  // Удержание признанного гарантийного долга поставщика (w.mkt.debt, задача
  // 99D-13): выплата уменьшается на остаток долга, не больше самой выплаты.
  const auto debt = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SUPPLIER_DEBT, o.offerer);
  eosio::asset withheld(0, _root_govern_symbol);
  if (debt.exists && debt.available.amount > 0) {
    withheld = debt.available.amount < o.fact_cost.amount ? debt.available : o.fact_cost;
  }
  const eosio::asset to_pay = o.fact_cost - withheld;

  if (to_pay.amount == 0) {
    // Долг покрывает всю выплату: банковского перевода не будет, удержание
    // проводится сразу, выплата считается завершённой.
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::DEDUCT_DEBT,
                   processes::marketplace::SUPPLY,
                   withheld, o.offerer, o.hash,
                   Marketplace::Memo::get_deduct_debt_memo(o.id));
    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.payout_status = OrderPayoutStatus::COMPLETED;
      upd.payout_decline_reason.clear();
      upd.payout_withheld.emplace(withheld);
    });
    return;
  }

  // Регистрация исходящего платежа в gateway на фактически принятую сумму
  // за вычетом удержания. Сам Дт 76 / Кт 51 и o.mkt.deduct произойдут в
  // callback'е `payconfirm` от gateway после действия кассира.
  Gateway::create_outcome(_marketplace, coopname, o.offerer, o.hash, to_pay,
                          _marketplace, "payconfirm"_n, "paydecline"_n);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::PENDING;
    upd.payout_decline_reason.clear();  // на случай повторной инициации после DECLINED
    upd.payout_withheld.emplace(withheld);
  });
}
