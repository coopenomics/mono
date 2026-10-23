/**
 * @brief Атомарная отмена списания средств
 * Возвращает средства из категории списанных в доступные
 * @param coopname Наименование кооператива
 * @param account_id ID счета для отмены списания
 * @param quantity Сумма для отмены списания
 * @param comment Комментарий к операции
 * @ingroup public_actions
 * @ingroup public_ledger_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]]
void ledger::writeoffcnsl(eosio::name coopname, uint64_t account_id, eosio::asset quantity, std::string comment, checksum256 hash, eosio::name username) {
  
  eosio::name payer = coopname;
  if (!has_auth(coopname)) {
    payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  } 

  eosio::check(quantity.is_valid(), "Некорректная сумма");
  eosio::check(quantity.amount > 0, "Сумма должна быть положительной");
  eosio::check(quantity.symbol == _root_govern_symbol, "Некорректный символ валюты");
  
  laccounts_index accounts(_ledger, coopname.value);
  auto account_iter = accounts.find(account_id);
  eosio::check(account_iter != accounts.end(), "Счет не найден");

  // Проверяем достаточность списанных средств
  eosio::check(account_iter->writeoff >= quantity, "Недостаточно списанных средств для отмены списания");

  // Атомарно переводим средства из writeoff в blocked
  accounts.modify(account_iter, RamPayer::of(accounts, coopname), [&](auto& acc) {
    acc.writeoff -= quantity;
    acc.blocked += quantity;
  });

} 