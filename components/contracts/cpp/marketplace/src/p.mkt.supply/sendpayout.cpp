/**
 * @brief Пакет выплаты отправляется кассиру одним исходящим платежом
 * (решение владельца 19.11.2026, p.mkt.supply).
 *
 * Inline-вызов `gateway::createoutpay` регистрирует один исходящий платёж на
 * сумму пакета: `outcome_hash` — хэш пакета, получатель — поставщик, обратные
 * вызовы — `payconfirm` / `paydecline`. Пакет переходит open → sent, и его
 * сумма больше не меняется: кассир переводит ровно зарегистрированную сумму.
 * Заказы, принятые после отправки, попадают в пакет следующего дня.
 *
 * Проводки здесь нет: Дт 76 / Кт 51 ставится по каждому заказу пакета после
 * подтверждения кассира (`closepayout`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::sendpayout(eosio::name coopname, checksum256 payout_hash) {
  require_auth(coopname);

  auto p = Marketplace::get_payout_by_hash_or_fail(coopname, payout_hash);
  eosio::check(p.status == PayoutStatus::OPEN,
               "MARKETPLACE_PAYOUT_NOT_OPEN: Пакет выплаты уже отправлен кассиру");
  eosio::check(p.orders > 0 && p.amount.amount > 0,
               "MARKETPLACE_PAYOUT_EMPTY: В пакете выплаты нет суммы к переводу");

  Gateway::create_outcome(_marketplace, coopname, p.offerer, p.hash, p.amount,
                          _marketplace, "payconfirm"_n, "paydecline"_n);

  Marketplace::update_payout(coopname, p.id, [&](auto& upd) {
    upd.status = PayoutStatus::SENT;
  });
}
