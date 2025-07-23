/**
 * @brief Коллбэк при успешном завершении платежа
 * @param coopname - имя кооператива
 * @param writeoff_hash - хэш операции списания
 */
[[eosio::action]]
void ledger::complete(eosio::name coopname, checksum256 writeoff_hash) {
  require_auth(_gateway);

  auto writeoff_opt = get_writeoff_by_hash(writeoff_hash);
  eosio::check(writeoff_opt.has_value(), "Операция не найдена");
  
  auto writeoff = writeoff_opt.value();
  eosio::check(writeoff.coopname == coopname, "Неверный кооператив");
  eosio::check(writeoff.status == "approved"_n, "Операция не одобрена");

  // Обновляем статус операции
  writeoffs_index writeoffs(_ledger, _ledger.value);
  auto writeoff_iter = writeoffs.find(writeoff.id);
  writeoffs.modify(writeoff_iter, _gateway, [&](auto& w) {
    w.status = "paid"_n;
  });

  // Списываем средства со счета
  laccounts_index accounts(_ledger, coopname.value);
  auto account_iter = accounts.find(writeoff.account_id);
  eosio::check(account_iter != accounts.end(), "Счет не найден");

  accounts.modify(account_iter, _gateway, [&](auto& acc) {
    acc.allocation -= writeoff.quantity;
    acc.writeoff += writeoff.quantity;
  });
} 