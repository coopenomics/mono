/**
 * @brief Встречная подпись председателя совета на доверенности председателя
 * кооперативного участка.
 * Callback одобрения совета: председатель совета подписал доверенность второй
 * подписью (механизм soviet::confirmapprv проверил его подпись). Фиксируем
 * полностью подписанную доверенность в реестре документов по якорю одобрения.
 * @param coopname Наименование кооператива
 * @param username Председатель кооперативного участка — уполномоченный по доверенности
 * @param approval_hash Якорь одобрения (хэш документа доверенности)
 * @param approved_document Доверенность с встречной подписью председателя совета
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
[[eosio::action]] void branch::apprauth(eosio::name coopname, eosio::name username, eosio::checksum256 approval_hash, document2 approved_document) {
  require_auth(_soviet);

  // Доверенность подписана обеими сторонами (председатель участка + председатель совета) —
  // фиксируем её в реестре документов как принятую.
  ::Soviet::make_complete_document(_branch, coopname, username, "branchauth"_n, approval_hash, approved_document);
}
