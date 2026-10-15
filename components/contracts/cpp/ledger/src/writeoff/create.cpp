/**

 *
 * @brief Создание заявления на списание средств через совет. 
 * Создает операцию списания, требующую одобрения советом
 * @param coopname Наименование кооператива
 * @param username Имя пользователя-инициатора списания
 * @param account_id ID счета для списания
 * @param quantity Сумма для списания
 * @param reason Обоснование списания
 * @param document Документ обоснования
 * @param writeoff_hash Хэш операции списания
 * @ingroup public_actions
 * @ingroup public_ledger_actions
 * @note Авторизация требуется от аккаунта: @p username
 */
[[eosio::action]]
void ledger::create(eosio::name coopname, eosio::name username, uint64_t account_id, eosio::asset quantity, std::string reason, document2 document, checksum256 writeoff_hash) {
  require_auth(coopname);

  eosio::check(quantity.is_valid(), "Некорректная сумма");
  eosio::check(quantity.amount > 0, "Сумма должна быть положительной");
  eosio::check(quantity.symbol == _root_govern_symbol, "Некорректный символ валюты");
  eosio::check(reason.length() > 0, "Обоснование должно быть от 1 символа");

  // Проверяем что кооператив существует
  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop_iter = coops.find(coopname.value);
  eosio::check(coop_iter != coops.end(), "Кооператив не найден");

  // Проверяем что счет существует
  laccounts_index accounts(_ledger, coopname.value);
  auto account_iter = accounts.find(account_id);
  eosio::check(account_iter != accounts.end(), "Счет не найден");

  // Проверяем достаточность средств
  eosio::check(account_iter -> available >= quantity, "Недостаточно средств на счету");

  // Проверяем уникальность writeoff_hash
  auto existing_writeoff = Ledger::get_writeoff_by_hash(writeoff_hash);
  eosio::check(!existing_writeoff.has_value(), "Операция с таким хэшем уже существует");

  // Создаем операцию ожидающую решения совета
  auto operation_id = get_global_id_in_scope(_ledger, _ledger, "writeoffs"_n);

  writeoffs_index writeoffs(_ledger, _ledger.value);
  writeoffs.emplace(RamPayer::of(writeoffs, coopname), [&](auto& op) {
    op.id = operation_id;
    op.coopname = coopname;
    op.username = username;
    op.account_id = account_id;
    op.quantity = quantity;
    op.reason = reason;
    op.document = document;
    op.writeoff_hash = writeoff_hash;
    op.status = "pending"_n;
  });

  // Создаем агенду в совете через Action::send
  ::Soviet::create_agenda(
    _ledger,
    coopname,
    username,
    get_valid_soviet_action("ledgerwthd"_n), // тип решения
    writeoff_hash,
    _ledger, // callback_contract
    Names::Ledger::AUTHORIZE_WRITEOFF, // confirm_callback
    Names::Ledger::DECLINE_WRITEOFF, // decline_callback
    document,
    reason
  );
  
  // Блокируем средства на счету
  std::string comment = "Служебная записка отправлена в совет для списания средств со счета " + account_iter->name + " на сумму " + quantity.to_string();
  Ledger::block(coopname, coopname, account_id, quantity, comment, writeoff_hash, username);  
  
} 