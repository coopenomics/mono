/**
 * @brief Обратный вызов от `soviet` после отказа по заявлению о возврате
 * паевого взноса имуществом или истечения срока повестки (паевая модель
 * выдачи, компонент 68). Сигнатура `(coopname, hash, reason)` —
 * `DECLINE_CALLBACK_SIGNATURE`; единственно допустимая авторизация — `_soviet`.
 *
 * Эффект: `issuepend → readyrecv`, документы выдачи снимаются, факт
 * возвращается к заказу. Резерв не трогается, движений по средствам нет.
 * Причина остаётся в журнале действий и в решении совета.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktisdecl(eosio::name coopname,
                               checksum256 hash,
                               std::string reason) {
  require_auth(_soviet);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, hash);
  eosio::check(o.status == OrderStatus::ISSUE_PENDING,
               "Заказ не ожидает решения совета по выдаче (обратный вызов повторный или поздний)");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::READY_TO_RECEIVE;
    Marketplace::clear_issue_documents(upd);
  });
}
