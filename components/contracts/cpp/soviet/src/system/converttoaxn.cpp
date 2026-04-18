void soviet::converttoaxn(eosio::name coopname, eosio::asset amount, document2 statement, checksum256 process_hash) {
  require_auth(_provider);

  // Проверяем заявление
  verify_document_or_fail(statement, {coopname});
  Document::validate_registry_id(statement, 51);

  // Проверяем, что сумма положительная
  eosio::check(amount.amount > 0, "Сумма должна быть положительной");

  // Проверяем символ - должен быть _root_govern_symbol (RUB)
  eosio::check(amount.symbol == _root_govern_symbol, "Неверный символ токена. Ожидается RUB");

  // Конвертируем по курсу 10:1 (10 RUB = 1 AXON)
  int64_t axon_amount = amount.amount / 10;
  eosio::check(axon_amount > 0, "После конвертации сумма AXON должна быть положительной");

  eosio::asset axon_quantity(axon_amount, _root_symbol);

  // Списываем RUB с кошелька provider (_wallet_program)
  Wallet::sub_available_funds(_soviet, _provider, coopname, amount, _wallet_program, "Конвертация RUB в AXON");


  // Пополняем кошелёк членских взносов в ledger
  std::string memo = "Членский взнос из числа средств паевого взноса по соглашению о подключении к платформе Кооперативной Экономики от пайщика с username=" + coopname.to_string();

  // Перенос средств из паевого фонда в фонд делегатских взносов через ledger2
  // (TRANSFER SHARE_FUND_PAY (2001) → DELEGATE_FEES (3003); Dr 80 / Cr 86).
  // Scope ledger2-операции — coopname (а не _provider): код-ревью 2026-04-18
  // Decision #7 выявил, что _provider некорректно передавался как coopname.
  // username проставляем _provider (делегат-инициатор).
  // process_hash формируется бэкендом явно (допустимо совпадение с statement.hash,
  // но это выбор бэкенда, а не контракта — см. architecture.md §3.8).
  Ledger2::apply(_soviet, coopname, ledger2_ops::CONVERT_TO_AXN, amount, _provider, process_hash, memo);

  // Вызываем инъекцию AXON токенов на кооператив
  action(
      permission_level{ _soviet, "active"_n },
      _system,
      "injection"_n,
      std::make_tuple(coopname, axon_quantity)
  ).send();

  // Фиксируем документ в реестре (ключ документа — его собственный хэш,
  // не связан с process_hash).
  Soviet::make_complete_document(
      _soviet,
      coopname,
      coopname,
      Names::Soviet::CONVERT_TO_AXON,
      statement.hash,
      statement
  );

}
