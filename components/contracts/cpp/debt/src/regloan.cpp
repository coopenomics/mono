/**
 * @brief Приложение зарегистрировало выданный им заём.
 *
 * Запись появляется в общем реестре выданной: пайщик, сумма, срок, источник и
 * ссылка на его сущность (у Генерации — хэш проекта). Обеспечение остаётся у
 * приложения, общий долг пайщика увеличивается.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от контракта из белого списка; он и становится источником записи
 */
void debt::regloan(REGLOAN_SIGNATURE) {
  name source = check_auth_and_get_payer_or_fail(contracts_whitelist);
  eosio::check(source != _debt, "Контракт займов регистрирует свои займы заявлением");

  Wallet::validate_asset(amount);
  eosio::check(!Debt::get_debt(coopname, debt_hash).has_value(), "Заём с таким хэшем уже существует");

  Debt::debts_index debts(_debt, coopname.value);
  uint64_t id = get_global_id_in_scope(_debt, coopname, "debts"_n);
  debts.emplace(RamPayer::of(debts, coopname), [&](auto& d) {
    d.id = id;
    d.coopname = coopname;
    d.username = username;
    d.status = Debt::Status::ISSUED;
    d.debt_hash = debt_hash;
    d.source = source;
    d.source_ref = source_ref;
    d.amount = amount;
    d.remaining = amount;
    d.pledged = eosio::asset(0, amount.symbol);
    d.created_at = Debt::Core::now();
    d.issued_at = Debt::Core::now();
    d.due_at = due_at;
    d.statement = statement;
    d.contract = contract;
  });

  Debt::Core::change_summary(coopname, username, amount);

  require_recipient(username);
  require_recipient(coopname);
}
