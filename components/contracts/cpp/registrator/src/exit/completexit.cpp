/**
 * @brief Завершение возврата паевого взноса при выходе из кооператива.
 * Кассир подтвердил исходящий платёж — gateway вызывает этот коллбэк.
 * Списываем зарезервированную сумму (o.wal.wthcpl: Дт80/Кт51, BURN с
 * w.wal.wpend), удаляем пайщика из реестра совета и блокируем его аккаунт.
 * Возврат назад невозможен — повторное участие только через новую регистрацию.
 * @param coopname Наименование кооператива
 * @param exit_hash Хэш процесса выхода
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p gateway
 */
void registrator::completexit(eosio::name coopname, checksum256 exit_hash) {
  require_auth(_gateway);

  auto exist = Registrator::get_exit_by_hash(coopname, exit_hash);
  eosio::check(exist.has_value(), "Объект выхода не найден");

  Registrator::exits_index exits(_registrator, coopname.value);
  auto e = exits.find(exist->username.value);
  eosio::check(e->status == "authorized"_n, "Только одобренные заявления на выход могут быть завершены");

  eosio::name username = e->username;

  // Проводка возврата паевого: списываем резерв w.wal.wpend, Дт80/Кт51.
  std::string memo = "Возврат паевого взноса при выходе из кооператива, username=" + username.to_string();
  Ledger2::apply(_registrator, coopname, operations::wallet::COMPLETE_WITHDRAW,
                 e->quantity, username, exit_hash, memo);

  // Финализируем выход: удаляем пайщика и блокируем аккаунт.
  Registrator::finalize_member_exit(coopname, username);

  exits.erase(e);
}
