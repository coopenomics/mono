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

  // Пополняем кошелёк членских взносов в ledger
  std::string memo = "Членский взнос из числа средств паевого взноса по соглашению о подключении к платформе Кооперативной Экономики от пайщика с username=" + coopname.to_string();

  // Перенос средств из паевого фонда в фонд делегатских взносов через ledger2
  // (TRANSFER SHARE_FUND_PAY (2001) → DELEGATE_FEES (3003); Dr 80 / Cr 86).
  //
  // ВНИМАНИЕ по наименованию параметров этого action: поле `coopname` в
  // action-сигнатуре семантически содержит **username** пайщика-инициатора
  // (backend: system.adapter.ts → `coopname: data.username`; см. memo ниже:
  // «от пайщика с username=...»). Реальный кооператив — `_provider`
  // (action выполняется под `require_auth(_provider)`).
  //
  // Поэтому для ledger2::apply:
  //   - 2-й аргумент (coopname-scope wallets2/accounts2) = `_provider`
  //     (реальный кооп, совпадает со scope legacy-кошелька в строке 21).
  //   - 5-й аргумент (username-инициатор для истории) = `coopname`-параметр
  //     (то есть username пайщика).
  // Иначе ledger2::apply падает на валидации cooperatives2_index: имя
  // пользователя не зарегистрировано как кооператив.
  //
  // process_hash формируется бэкендом явно (допустимо совпадение с
  // statement.hash — одноактовый процесс p.sov.axncnv).
  Ledger2::apply(_soviet, _provider, operations::soviet::CONVERT_AXN, amount, coopname, process_hash, memo);

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
