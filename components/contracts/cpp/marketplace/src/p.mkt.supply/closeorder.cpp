/**
 * @brief Backend закрывает выданный заказ после выхода гарантийного срока
 * (p.mkt.supply; принцип конечного жизненного цикла RAM-записей).
 *
 * Терминал жизненного цикла выданного заказа: запись стирается из RAM,
 * история заказа (акты, выплата, гарантия) остаётся в журнале действий.
 * Вызывается автоматизированной службой по расписанию; контракт — финальный
 * судья условий закрытия, до их наступления закрытие отклоняется:
 *
 * Guards:
 *  - require_auth(coopname) — backend от имени кооператива;
 *  - заказ в статусе received (выдан заказчику);
 *  - гарантийный срок вышел: warranty_until ≤ now. Для заказов без гарантии
 *    (warranty_period_secs == 0) условие считается выполненным сразу;
 *  - гарантийный возврат не в работе: если по заказу подавалось заявление
 *    (return_request_id != 0), его запись должна быть уже стёрта терминалом
 *    процесса возврата;
 *  - выплата поставщику завершена (payout_status == completed). Заказ из
 *    остатка кооператива (offerer == coopname) выплаты не предполагает.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::closeorder(eosio::name coopname,
                              checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::RECEIVED,
               "Закрыть можно только выданный заказ");

  if (o.warranty_period_secs > 0) {
    const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    eosio::check(now >= o.warranty_until,
                 "Гарантийный срок по заказу ещё не вышел — закрытие недоступно");
  }

  if (o.return_request_id != 0) {
    Marketplace::return_requests_index requests(_marketplace, coopname.value);
    eosio::check(requests.find(o.return_request_id) == requests.end(),
                 "По заказу открыт гарантийный возврат — дождитесь его завершения");
  }

  if (o.offerer != coopname) {
    eosio::check(o.payout_status == OrderPayoutStatus::COMPLETED,
                 "Выплата поставщику по заказу не завершена — закрытие недоступно");
  }

  Marketplace::erase_order(coopname, o.id);
}
