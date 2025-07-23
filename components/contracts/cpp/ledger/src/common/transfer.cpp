/**
 * @brief Перевод средств между счетами
 * @param coopname - имя кооператива
 * @param from_account_id - идентификатор счета списания
 * @param to_account_id - идентификатор счета зачисления
 * @param quantity - сумма перевода
 * @param comment - комментарий к операции
 */
[[eosio::action]]
void ledger::transfer(eosio::name coopname, uint64_t from_account_id, uint64_t to_account_id, eosio::asset quantity, std::string comment) {
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  } 

  eosio::check(quantity.is_valid(), "Некорректная сумма");
  eosio::check(quantity.amount > 0, "Сумма должна быть положительной");
  eosio::check(quantity.symbol == _root_govern_symbol, "Некорректный символ валюты");
  eosio::check(from_account_id != to_account_id, "Счета списания и зачисления должны отличаться");

  laccounts_index accounts(_ledger, coopname.value);
  
  auto from_account_iter = accounts.find(from_account_id);
  eosio::check(from_account_iter != accounts.end(), "Счет списания не найден");
  
  auto to_account_iter = accounts.find(to_account_id);
  eosio::check(to_account_iter != accounts.end(), "Счет зачисления не найден");

  // Проверяем достаточность средств
  eosio::check(from_account_iter->allocation >= quantity, "Недостаточно средств для перевода");

  // Списываем с источника
  accounts.modify(from_account_iter, coopname, [&](auto& acc) {
    acc.allocation -= quantity;
  });

  // Зачисляем на получателя
  accounts.modify(to_account_iter, coopname, [&](auto& acc) {
    acc.allocation += quantity;
  });
} 