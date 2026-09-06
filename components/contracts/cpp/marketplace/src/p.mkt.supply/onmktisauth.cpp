/**
 * @brief Обратный вызов от `soviet::exec` после утверждения Протокола решения
 * совета о возврате паевого взноса имуществом (registry 1114) — паевая модель
 * выдачи (компонент 68). Сигнатура `(coopname, hash, authorization)` задана
 * `AUTHORIZE_CALLBACK_SIGNATURE`; единственно допустимая авторизация — `_soviet`.
 *
 * Эффект: `issuepend → issueauth`, протокол сохраняется в `issue_protocol`.
 * Дальше заказчик ставит первую подпись акта (issueact1).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktisauth(eosio::name coopname,
                               checksum256 hash,
                               document2 authorization) {
  require_auth(_soviet);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, hash);
  eosio::check(o.status == OrderStatus::ISSUE_PENDING,
               "Заказ не ожидает решения совета по выдаче (обратный вызов повторный или поздний)");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status         = OrderStatus::ISSUE_AUTHORIZED;
    upd.issue_protocol = authorization;
  });
}
