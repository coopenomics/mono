/**
 * @brief Обратный вызов gateway::outcomplete: кассир подтвердил банковский
 * перевод пакета выплаты поставщику (p.mkt.supply).
 *
 * Пакет переходит sent → paid. Проводки Дт 76 / Кт 51 ставятся по каждому
 * заказу пакета действием `closepayout`: одно действие обрабатывает один заказ,
 * перебора заказов здесь нет. Сумма проводок по заказам пакета равна сумме
 * перевода — её зарегистрировал `sendpayout`.
 *
 * Авторизация: `_gateway`. `outcome_hash` — хэш пакета.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::payconfirm(eosio::name coopname, checksum256 outcome_hash) {
  require_auth(_gateway);

  auto p = Marketplace::get_payout_by_hash_or_fail(coopname, outcome_hash);
  eosio::check(p.status == PayoutStatus::SENT,
               "MARKETPLACE_PAYOUT_NOT_SENT: Подтверждение кассира получено на пакет выплаты, не отправленный кассиру");

  Marketplace::update_payout(coopname, p.id, [&](auto& upd) {
    upd.status = PayoutStatus::PAID;
  });
}
