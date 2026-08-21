/**
 * @brief Верификация аккаунта.
 * Верифицирует аккаунты как пользователей, так и организаций
 * @param username Имя аккаунта, который подлежит верификации
 * @param procedure Процедура верификации (online)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p provider
 */
[[eosio::action]] void registrator::verificate(eosio::name username, eosio::name procedure)
{
  require_auth(_provider);
  eosio::check(procedure == "online"_n, "Только онлайн-верификация доступна сейчас");

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");

  if (procedure == "online"_n)
  {
    accounts.modify(account, _provider, [&](auto &a)
    {
    
      for (const auto& ver : a.verifications) {
        eosio::check(!(ver.procedure == "online"_n && ver.is_verified), "Онлайн верификация уже проведена");
      }
      
      verification new_verification {
        .verificator = _ano,
        .is_verified = true,
        .procedure = procedure,
        .created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()),
        .last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()),
        .notice = ""
      };

      a.verifications.push_back(new_verification); 
    
    });
  }
  else
  {
    eosio::check(false, "Только онлайн-верификация доступна сейчас");
  }
}
