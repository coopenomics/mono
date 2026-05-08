/**
 * @brief Авторизует возврат из программы благороста советом
 * Авторизует возврат из программы благороста советом и выполняет операции с балансами:
 * - Получает объект возврата
 * - Списывает заблокированные средства из программы благороста
 * - Добавляет доступные средства в кошелек программы
 * - Удаляет объект возврата
 * @param coopname Наименование кооператива
 * @param withdraw_hash Хеш заявки на возврат для авторизации
 * @param authorization Документ авторизации совета
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void capital::capauthwthd3(name coopname, checksum256 withdraw_hash, document2 authorization) {
  require_auth(_soviet);
  
  auto exist_withdraw = Capital::get_program_withdraw(coopname, withdraw_hash);
  eosio::check(exist_withdraw.has_value(), "Объект возврата не найден");
  
  Capital::program_withdraws_index program_withdraws(_capital, coopname.value);
  auto withdraw = program_withdraws.find(exist_withdraw -> id);
  
  eosio::check(withdraw != program_withdraws.end(), "Объект возврата не найден");

  std::string memo = Capital::Memo::get_program_withdraw_memo(withdraw -> id);

  // ledger2: TRANSFER w.cap.blago → w.wal.share (без бухпроводки — оба счёта 80, зеркало INVEST).
  Ledger2::apply(_capital, coopname, operations::capital::WITHDRAW_FROM_CAPITAL,
                 withdraw->amount, withdraw->username, withdraw_hash, memo);

  program_withdraws.erase(withdraw);
}