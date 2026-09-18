/**
 * @brief Принимает принятый председателем договор УХД и активирует участника по нему
 * Активирует пайщика в системе кооператива после одобрения договора УХД:
 * - Проверяет подлинность договора УХД
 * - Валидирует статус пайщика (должен быть PENDING)
 * - Активирует пайщика и устанавливает принятый договор
 * - Создает программный кошелек для пайщика если необходимо
 * @param coopname Имя кооператива
 * @param username Наименование пользователя, одобрившего регистрацию
 * @param contributor_hash Хэш контрибьютора
 * @param contract Договор УХД
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от контракта совета
 */
void capital::approvereg(eosio::name coopname, eosio::name username, checksum256 contributor_hash, document2 contract) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  verify_document_or_fail(contract);
  // Договор подписан ключом аккаунта того, кто его утверждает.
  verify_signer_keys_or_fail(contract, username);
  
  auto exist = Capital::Contributors::get_contributor_by_hash(coopname, contributor_hash);
  eosio::check(exist.has_value(), "Пайщик не обладает подписанным договором УХД");
  eosio::check(exist -> status == Capital::Contributors::Status::PENDING, "Договор УХД должен находиться в статусе pending для приёма.");
  
  Capital::contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(exist -> id);

  eosio::check(contributor != contributors.end(), "Пайщик не зарегистрирован в контракте");

  if (is_empty_document(contract)) {
    eosio::check(contributor -> is_external_contract, "Договор УХД должен быть внешним для приёма пустого документа");

  } else {
    // Фиксируем документ в реестре как принятый
    Soviet::make_complete_document(_capital, coopname, contributor -> username, Names::Capital::REGISTER_CONTRIBUTOR, contract.hash, contract);
  };
  
  // Обновляем пайщика и устанавливаем принятый договор УХД
  contributors.modify(contributor, payer, [&](auto &c){
    c.status = Capital::Contributors::Status::ACTIVE;
    c.contract = contract;
  });

};