/**
 * @brief Одобрение заявки доверенного лица председателем участка.
 * Председатель кооперативного участка накладывает встречную подпись на договор
 * материальной ответственности и доверенность заявителя; оба полностью подписанных
 * документа фиксируются в реестре документов, пайщик добавляется в список доверенных
 * лиц участка, заявка стирается.
 * @param coopname Наименование кооператива
 * @param hash Внешний идентификатор заявки
 * @param countersigned Договор материальной ответственности со встречной подписью председателя участка
 * @param countersigned_authority Доверенность доверенному лицу со встречной подписью председателя участка
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::apprtrusted(eosio::name coopname, eosio::checksum256 hash, document2 countersigned, document2 countersigned_authority) {
  check_auth_or_fail(_branch, coopname, coopname, "apprtrusted"_n);

  verify_document_or_fail(countersigned);
  verify_document_or_fail(countersigned_authority);

  auto req = get_trustreq_or_fail(coopname, hash);

  auto br = get_branch_or_fail(coopname, req.braname);
  eosio::check(!br.is_account_in_trusted(req.username), "Пайщик уже является доверенным лицом участка");
  eosio::check(br.trusted.size() < 3, "Достигнут предел доверенных лиц участка (не более трёх)");

  branch_index branches(_branch, coopname.value);
  auto bitr = branches.find(req.braname.value);
  branches.modify(bitr, coopname, [&](auto &row) {
    row.add_account_to_trusted(req.username);
  });

  // Оба документа подписаны обеими сторонами (доверенное лицо + председатель участка) —
  // фиксируем их в реестре документов как принятые.
  ::Soviet::make_complete_document(_branch, coopname, req.username, "trustliab"_n, hash, countersigned);
  ::Soviet::make_complete_document(_branch, coopname, req.username, "trustauth"_n, hash, countersigned_authority);

  trustreq_index trustreqs(_branch, coopname.value);
  auto ritr = trustreqs.find(req.id);
  trustreqs.erase(ritr);
}
