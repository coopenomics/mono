
/**
 * @brief Заявление на беспроцентный заём под обеспечение паевым взносом.
 *
 * Пайщик подписывает заявление и договор одной операцией. Сумма обеспечения,
 * равная займу, переводится с кошелька программы на кошелёк обеспечения и в
 * программе больше не участвует. Заявление уходит повесткой в совет.
 *
 * @param coopname Наименование кооператива
 * @param username Пайщик-заёмщик
 * @param collateral Ключ обеспечения из реестра (например, `blago`)
 * @param debt_hash Хэш займа; его короткая форма — номер договора
 * @param amount Сумма займа
 * @param due_at Срок возврата
 * @param statement Заявление на получение займа с подписью пайщика
 * @param contract Договор о беспроцентном займе с подписью пайщика
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::createloan(eosio::name coopname, eosio::name username, eosio::name collateral,
                      checksum256 debt_hash, eosio::asset amount, eosio::time_point_sec due_at,
                      document2 statement, document2 contract) {
  require_auth(coopname);

  const auto& c = Debt::get_collateral_or_fail(collateral);
  Wallet::validate_asset(amount);
  eosio::check(due_at > Debt::Core::now(), "Срок возврата должен быть в будущем");
  eosio::check(!Debt::get_debt(coopname, debt_hash).has_value(), "Заём с таким хэшем уже существует");

  eosio::check(!is_empty_document(statement), "Нужно заявление на получение займа с подписью пайщика");
  eosio::check(!is_empty_document(contract), "Нужен договор о беспроцентном займе с подписью пайщика");
  verify_document_or_fail(statement, {username});
  verify_document_or_fail(contract, {username});
  // Оба документа подписывает сам пайщик. Транзакцию шлёт кооператив, поэтому ключи сверяются с аккаунтом.
  verify_signer_keys_or_fail(statement, username);
  verify_signer_keys_or_fail(contract, username);

  eosio::asset available = Ledger2::get_user_available(coopname, c.source_wallet, username);
  eosio::check(available >= amount, "Недостаточно средств на кошельке программы для обеспечения займа");

  // Программа-владелец проверяет договор пайщика и пересчитывает начисления, затем обеспечение уходит на кошелёк обеспечения.
  Debt::Core::pledge(c, coopname, username, amount, debt_hash);

  Debt::debts_index debts(_debt, coopname.value);
  uint64_t id = get_global_id_in_scope(_debt, coopname, "debts"_n);
  debts.emplace(RamPayer::of(debts, coopname), [&](auto& d) {
    d.id = id;
    d.coopname = coopname;
    d.username = username;
    d.status = Debt::Status::CREATED;
    d.debt_hash = debt_hash;
    d.collateral = collateral;
    d.source = _debt;
    d.amount = amount;
    d.remaining = amount;
    d.pledged = amount;
    d.created_at = Debt::Core::now();
    d.due_at = due_at;
    d.statement = statement;
    d.contract = contract;
  });

  // Повестка совета: документ — заявление пайщика, протокол собирается по его метаданным.
  Soviet::create_agenda(_debt, coopname, username, get_valid_soviet_action(Names::SovietActions::CREATE_DEBT),
                        debt_hash, _debt, Names::Debt::ON_AUTHORIZED, Names::Debt::ON_DECLINED, statement,
                        std::string(""));

  require_recipient(username);
  require_recipient(coopname);
}
