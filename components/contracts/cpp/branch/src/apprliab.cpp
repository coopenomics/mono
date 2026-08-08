/**
 * @brief Встречная подпись председателя совета на договоре о полной материальной
 * ответственности председателя кооперативного участка.
 * Callback одобрения совета: председатель совета подписал договор второй подписью
 * (механизм soviet::confirmapprv проверил его подпись). Фиксируем полностью
 * подписанный договор в реестре документов по якорю процесса.
 * @param coopname Наименование кооператива
 * @param username Председатель кооперативного участка — сторона «Исполнитель»
 * @param approval_hash Якорь процесса (хэш одобрения)
 * @param approved_document Договор с встречной подписью председателя совета
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
[[eosio::action]] void branch::apprliab(eosio::name coopname, eosio::name username, eosio::checksum256 approval_hash, document2 approved_document) {
  require_auth(_soviet);

  // Договор подписан обеими сторонами (председатель участка + председатель совета) —
  // фиксируем его в реестре документов как принятый.
  ::Soviet::make_complete_document(_branch, coopname, username, "branchliab"_n, approval_hash, approved_document);
}
