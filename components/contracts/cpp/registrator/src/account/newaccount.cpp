/**
 * @brief Регистрация нового аккаунта.
 * Создает новый аккаунт в системе блокчейна
 * @param coopname Наименование кооператива
 * @param referer Реферер, который представил нового пользователя
 * @param username Имя нового аккаунта (от 5 до 12 символов)
 * @param public_key Открытый ключ нового аккаунта
 * @param meta Дополнительная мета-информация
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void registrator::newaccount(
    eosio::name coopname, eosio::name referer,
    eosio::name username, eosio::public_key public_key, std::string meta)
{
  require_auth(coopname);

  authority active_auth;
  active_auth.threshold = 1;
  key_weight keypermission{public_key, 1};
  active_auth.keys.emplace_back(keypermission);

  authority owner_auth;
  owner_auth.threshold = 1;

  // Устанавливаем разрешение eosio.prods@active для владельца
  permission_level_weight eosio_prods_plw{
      {_registrator, "active"_n},
      1};

  owner_auth.accounts.push_back(eosio_prods_plw);

  action(permission_level(_registrator, "active"_n), "eosio"_n, "createaccnt"_n,
         std::tuple(coopname, username, owner_auth, active_auth))
      .send();

  accounts_index accounts(_registrator, _registrator.value);
  auto card = accounts.find(username.value);

  eosio::check(card == accounts.end(), "Аккаунт уже зарегистририван");

  accounts.emplace(RamPayer::of(accounts, coopname), [&](auto &n)
    {
      n.username = username;
      n.status = "pending"_n;
      n.registrator = coopname;
      n.referer = referer;
      n.registered_at =
          eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
      n.meta = meta; 
    });
}
