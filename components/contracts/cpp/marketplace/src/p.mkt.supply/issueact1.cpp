/**
 * @brief Первая подпись Акта приёма-передачи имущества в счёт возврата
 * паевого взноса (registry 1115) заказчиком — паевая модель выдачи
 * (компонент 68). Ставится устройством заказчика по получении протокола без
 * нового нажатия; при обрыве связи досылается при возвращении в приложение.
 *
 * Эффект: `issueauth → issueact1`, `issue_act1` = акт. Без движений по
 * средствам — до закрывающей подписи председателя ничего не состоялось.
 *
 * Guards:
 *  - actor coopname; orderer — заказчик; order.status == issueauth;
 *  - в заказе есть протокол совета; акт подписан заказчиком.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::issueact1(eosio::name coopname,
                             eosio::name orderer,
                             checksum256 order_hash,
                             document2 act) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer, "Вы не заказчик этого заказа");
  eosio::check(o.status == OrderStatus::ISSUE_AUTHORIZED,
               "Акт можно подписать только после решения совета о выдаче");
  eosio::check(!is_empty_document(o.issue_protocol),
               "В заказе нет протокола решения совета");
  eosio::check(is_empty_document(o.issue_act1),
               "Первая подпись акта выдачи уже зафиксирована");
  eosio::check(!is_empty_document(act), "Отсутствует акт приёма-передачи");
  verify_document_or_fail(act, { orderer });

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status     = OrderStatus::ISSUE_ACT1;
    upd.issue_act1 = act;
  });
}
