/**
 * @brief Оператор участка выдачи отменяет начатую выдачу (паевая модель,
 * компонент 68): заказчик не подписал акт, ушёл или отказался после решения
 * совета. Из `issueauth` / `issueact1` обратно в `readyrecv`; заявление,
 * протокол и подписи акта снимаются, факт возвращается к заказу. Резерв не
 * трогается — движений по средствам нет.
 *
 * Из `issuepend` отмена невозможна: повестка совета открыта, её исход придёт
 * обратным вызовом (onmktisdecl вернёт заказ в readyrecv сам).
 *
 * Guards:
 *  - actor coopname; order.status ∈ {issueauth, issueact1};
 *  - signer уполномочен на участке выдачи.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::cancelissue(eosio::name coopname,
                               eosio::name signer,
                               checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ISSUE_AUTHORIZED ||
               o.status == OrderStatus::ISSUE_ACT1,
               o.status == OrderStatus::ISSUE_PENDING
                 ? "Выдачу нельзя отменить, пока совет не ответил по заявлению"
                 : "Выдача по заказу не начата или уже закрыта");

  auto branch = get_branch_or_fail(coopname, o.delivery_braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен отменять выдачу на данном кооперативном участке");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::READY_TO_RECEIVE;
    Marketplace::clear_issue_documents(upd);
  });
}
