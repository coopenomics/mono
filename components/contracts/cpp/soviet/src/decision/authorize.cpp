/**
 * @brief Авторизация принятого решения советом
 * Позволяет председателю совета утвердить принятое решение совета.
 * Изменяет статус решения на авторизованное и добавляет документ авторизации.
 * @param coopname Наименование кооператива
 * @param chairman Наименование председателя совета кооператива
 * @param decision_id Идентификатор решения для авторизации
 * @param document Документ авторизации решения
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void soviet::authorize(eosio::name coopname, eosio::name chairman, uint64_t decision_id, document2 document) {
  // Авторизует кооператив (действие проводится через бэкенд ключом кооператива).
  // Согласие председателя при этом не теряется: оно подтверждается криптографически
  // его личной подписью на документе (verify_document_or_fail ниже) и проверкой
  // is_valid_chairman — без валидного подписанного председателем документа авторизация невозможна.
  require_auth(coopname);

  boards_index boards(_soviet, coopname.value);
  autosigner_index autosigner(_soviet, coopname.value);
  
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ не найден");
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_valid_chairman(chairman), "Только председатель совета может утвердить решение");
  
  eosio::check(decision -> approved == true, "Консенсус совета по решению не достигнут");

  verify_document_or_fail(document);

  // RAM-плательщик — кооператив: транзакцию авторизует coopname (require_auth выше),
  // поэтому увеличивать RAM аккаунта председателя нельзя (он tx не подписывал).
  decisions.modify(decision, coopname, [&](auto &d){
    d.authorized_by = chairman;
    d.authorized = !decision -> authorized;
    d.authorization = document;
  });

  auto signer = autosigner.find(decision -> id);
  
  if (signer != autosigner.end())
    autosigner.erase(signer);

}