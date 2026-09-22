/**
 * @brief Завершение операции списания от gateway
 * Коллбэк от gateway при успешном завершении операции
 * @param coopname Наименование кооператива
 * @param writeoff_hash Хэш операции списания для завершения
 * @ingroup public_actions
 * @ingroup public_ledger_actions

 * @note Авторизация требуется от аккаунта: @p gateway
 */
[[eosio::action]]
void ledger::complete(eosio::name coopname, checksum256 writeoff_hash) {
  require_auth(_gateway);

  auto writeoff_opt = Ledger::get_writeoff_by_hash(writeoff_hash);
  eosio::check(writeoff_opt.has_value(), "Операция не найдена");
  
  auto writeoff = writeoff_opt.value();
  eosio::check(writeoff.coopname == coopname, "Неверный кооператив");
  eosio::check(writeoff.status == "approved"_n, "Операция не одобрена");

  // Обновляем статус операции
  writeoffs_index writeoffs(_ledger, _ledger.value);
  auto writeoff_iter = writeoffs.find(writeoff.id);
  writeoffs.modify(writeoff_iter, RamPayer::of(writeoffs, coopname), [&](auto& w) {
    w.status = "paid"_n;
  });

  // Списываем средства со счета
  laccounts_index accounts(_ledger, coopname.value);
  auto account_iter = accounts.find(writeoff.account_id);
  eosio::check(account_iter != accounts.end(), "Счет не найден");

  accounts.modify(account_iter, RamPayer::of(accounts, coopname), [&](auto& acc) {
    acc.blocked -= writeoff.quantity;
    acc.writeoff += writeoff.quantity;
  });
} 