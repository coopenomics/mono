

/**
 * @brief Обновление метаданных аккаунта.
 * Обновляет метаданные указанного аккаунта
 * @param username Имя аккаунта, который обновляет метаданные
 * @param account_to_change Имя аккаунта, который требуется обновить
 * @param meta Новые метаданные для аккаунта
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p username
 */
void registrator::updateaccnt(eosio::name username, eosio::name account_to_change, std::string meta)
{
  require_auth(username);

  if (account_to_change != username)
    check_auth_or_fail(_registrator, account_to_change, username, "updateaccnt"_n);
  
  accounts_index accounts(_registrator, _registrator.value);

  auto account = accounts.find(account_to_change.value);

  eosio::check(account != accounts.end(), "Аккаунт не зарегистрирован");

  accounts.modify(account, RamPayer::of(accounts), [&](auto &acc){ 
    acc.meta = meta; 
  });
}
