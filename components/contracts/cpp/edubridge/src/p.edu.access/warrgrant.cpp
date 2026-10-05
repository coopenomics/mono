/**
 * @brief Публикация протокола решения совета об удовлетворении заявления по
 * Гарантийным условиям.
 *
 * Совет удовлетворил заявление участника (п. 4.4.3–4.4.4 Положения о ЦПП
 * «Образование»): подписка аннулируется, вся списанная стоимость возвращается
 * на паевой. Возврат проводит `cancelsub` в той же транзакции; здесь протокол
 * (шаблон 3014) публикуется в реестре документов и привязывается к заявлению.
 * Движений средств нет.
 *
 * Guards:
 *  - протокол не пустой и целостный;
 *  - пайщик — действующий член кооператива.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::warrgrant(eosio::name coopname,
                          eosio::name username,
                          checksum256 claim_hash,
                          document2 decision) {
  require_auth(coopname);

  eosio::check(!is_empty_document(decision),
               "Отсутствует протокол решения совета по заявлению об аннулировании подписки");
  verify_document_or_fail(decision);

  get_participant_or_fail(coopname, username);

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "warrgrant"_n,
                                 claim_hash, decision);
}
