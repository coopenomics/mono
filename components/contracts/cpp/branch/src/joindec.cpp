/**
 * @brief Присоединение пайщика к собранию.
 * Пайщик подписывает заявление о присоединении и фиксируется в списке участников.
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param username Имя присоединяющегося пайщика
 * @param statement Подписанное заявление о присоединении
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::joindec(eosio::name coopname, eosio::checksum256 hash, eosio::name username, document2 statement) {
  check_auth_or_fail(_branch, coopname, coopname, "joindec"_n);

  verify_document_or_fail(statement);

  get_participant_or_fail(coopname, username);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "opened"_n, "Присоединиться можно только до начала голосования");
  eosio::check(!dec.is_participant(username), "Пайщик уже присоединился к собранию");

  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.participants.push_back(username);
  });
}
