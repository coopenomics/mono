/**
 * @brief Коллбэк при отклонении платежа или решения совета
 * @param coopname - имя кооператива
 * @param writeoff_hash - хэш операции списания
 * @param reason - причина отклонения
 */
[[eosio::action]]
void ledger::decline(eosio::name coopname, checksum256 writeoff_hash, std::string reason) {
  // Может быть вызван от _soviet (отклонение решения) или _gateway (отклонение платежа)
  eosio::check(has_auth(_soviet) || has_auth(_gateway), "Недостаточно прав для отклонения операции");

  auto writeoff_opt = get_writeoff_by_hash(writeoff_hash);
  eosio::check(writeoff_opt.has_value(), "Операция не найдена");
  
  auto writeoff = writeoff_opt.value();
  eosio::check(writeoff.coopname == coopname, "Неверный кооператив");

  // Обновляем статус операции
  writeoffs_index writeoffs(_ledger, _ledger.value);
  auto writeoff_iter = writeoffs.find(writeoff.id);
  writeoffs.erase(writeoff_iter);
} 