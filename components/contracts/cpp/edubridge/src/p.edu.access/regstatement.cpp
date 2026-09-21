/**
 * @brief Публикация Заявления о взносе, целиком покрытом кошельком программы.
 *
 * Обычно заявление (шаблон 3011) публикует `convert`. Когда взнос за период
 * полностью покрыт остатком кошелька программы участника, конвертации нет —
 * и подписанное заявление публикуется этим действием в той же транзакцией,
 * что открытие либо продление подписки. Движений средств нет.
 *
 * Guards:
 *  - заявление не пустое и подписано ключом самого пайщика;
 *  - пайщик — действующий член кооператива.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::regstatement(eosio::name coopname,
                             eosio::name username,
                             document2 statement) {
  require_auth(coopname);

  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление о членском взносе по программе");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "regstatement"_n,
                                 statement.hash, statement);
}
