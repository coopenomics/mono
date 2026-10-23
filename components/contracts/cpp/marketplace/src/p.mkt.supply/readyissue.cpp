/**
 * @brief Оператор участка выдачи отмечает поступление имущества по заказу на
 * свой участок (паевая модель, компонент 68). Заменяет прежнюю первую подпись
 * акта выдачи (readyissue): подписи и документов на этом шаге нет.
 *
 * Эффект: `acceptcoop → readyrecv`, `current_warehouse_braname` = участок
 * выдачи — точка хранения переходит «скачком», промежуточные перемещения между
 * участками контрактом не подписываются.
 *
 * Guards:
 *  - actor coopname (require_auth);
 *  - order.status == acceptcoop;
 *  - signer уполномочен на участке выдачи (`Branch::is_user_authorized`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::readyissue(eosio::name coopname,
                              eosio::name signer,
                              checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP,
               "Заказ не готов к выдаче: имущество ещё не принято кооперативом");

  auto branch = get_branch_or_fail(coopname, o.delivery_braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен отмечать готовность к выдаче на данном кооперативном участке");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::READY_TO_RECEIVE;
    upd.current_warehouse_braname = o.delivery_braname;
  });
}
