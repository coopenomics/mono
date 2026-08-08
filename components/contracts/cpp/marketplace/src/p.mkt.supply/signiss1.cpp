/**
 * @brief Председатель КУ выдачи открывает выдачу первой подписью АПП-выдачи
 * (Story 6.1, signiss1).
 *
 * Без ledger2-операций. Per-Order: статус accepted_to_coop → ready_to_receive;
 * issue_act_signiss1 сохраняется; current_warehouse_braname обновляется на
 * delivery_braname (фиксация факта логистической передачи имущества на склад
 * выдачи — промежуточные перемещения по заготовочным КУ контрактом не
 * подписываются, точка хранения переходит «скачком» в этот момент).
 * Нотификация заказчику — post-effect в backend через ParserClient.
 *
 * Guards:
 *  - Order существует и в статусе accepted_to_coop.
 *  - Подписант (`signer`) авторизован для КУ выдачи (`o.delivery_braname`):
 *    председатель / trustee / trusted в `branches[delivery_braname]`.
 *  - verify_document_or_fail(act, {signer}).
 *  - Idempotency: is_empty_document(issue_act_signiss1).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signiss1(eosio::name coopname,
                            eosio::name signer,
                            checksum256 order_hash,
                            document2 act) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP,
               "Заказ не готов к открытию выдачи");
  eosio::check(is_empty_document(o.issue_act_signiss1),
               "Первая подпись акта выдачи уже зафиксирована");

  auto branch = get_branch_or_fail(coopname, o.delivery_braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен подписывать акты выдачи данного кооперативного участка");

  verify_document_or_fail(act, { signer });

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::READY_TO_RECEIVE;
    upd.issue_act_signiss1 = act;
    upd.current_warehouse_braname = o.delivery_braname;  // имущество готово к выдаче на КУ выдачи
  });
}
