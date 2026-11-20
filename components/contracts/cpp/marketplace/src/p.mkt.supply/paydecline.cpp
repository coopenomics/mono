/**
 * @brief Обратный вызов gateway::outdecline: кассир отметил, что банковский
 * перевод пакета не состоялся (p.mkt.supply).
 *
 * Пакет переходит sent → declined, причина сохраняется. Проводки нет —
 * обязательство Кт 76 по заказам остаётся открытым. Заказы пакета
 * возвращаются в ожидание выплаты по одному (`releasepay`) и попадают в
 * пакет следующего дня.
 *
 * Авторизация: `_gateway`. `outcome_hash` — хэш пакета.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::paydecline(eosio::name coopname, checksum256 outcome_hash, std::string reason) {
  require_auth(_gateway);

  auto p = Marketplace::get_payout_by_hash_or_fail(coopname, outcome_hash);
  eosio::check(p.status == PayoutStatus::SENT,
               "MARKETPLACE_PAYOUT_NOT_SENT: Отказ кассира получен на пакет выплаты, не отправленный кассиру");

  Marketplace::update_payout(coopname, p.id, [&](auto& upd) {
    upd.status = PayoutStatus::DECLINED;
    upd.decline_reason = reason;
  });
}
