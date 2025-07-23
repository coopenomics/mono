/**
 * @brief Создание заявления в совет для списания средств
 * @param coopname - имя кооператива
 * @param username - инициатор заявления
 * @param account_id - идентификатор счета для списания
 * @param quantity - сумма списания
 * @param reason - обоснование списания
 * @param document - документ обоснования
 * @param writeoff_hash - внешний хэш операции списания
 */
[[eosio::action]]
void ledger::create(eosio::name coopname, eosio::name username, uint64_t account_id, eosio::asset quantity, std::string reason, document2 document, checksum256 writeoff_hash) {
  require_auth(username);

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
  eosio::check(account_iter -> allocation >= quantity, "Недостаточно средств на счету");

  // Проверяем уникальность writeoff_hash
  auto existing_writeoff = get_writeoff_by_hash(writeoff_hash);
  eosio::check(!existing_writeoff.has_value(), "Операция с таким хэшем уже существует");

  // Создаем операцию ожидающую решения совета
  auto operation_id = get_global_id_in_scope(_ledger, _ledger, "writeoffs"_n);

  writeoffs_index writeoffs(_ledger, _ledger.value);
  writeoffs.emplace(username, [&](auto& op) {
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
  Action::send<createagenda_interface>(
    _soviet,
    "createagenda"_n,
    username,
    coopname,
    username,
    get_valid_soviet_action("ledgerwthd"_n), // тип решения
    writeoff_hash,
    _ledger, // callback_contract
    "auth"_n, // confirm_callback
    "decline"_n, // decline_callback
    document,
    reason
  );
} 