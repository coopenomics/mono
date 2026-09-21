/**
 * @brief Создание филиала кооператива.
 * Создает новый аккаунт для филиала кооператива
 * @param coopname Наименование кооператива
 * @param braname Наименование филиала
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p branch
 */
void registrator::createbranch(eosio::name coopname, eosio::name braname) {
  require_auth(_branch);
  
  authority active_auth;
  active_auth.threshold = 1;

  authority owner_auth;
  owner_auth.threshold = 1;

  // Устанавливаем разрешение eosio.prods@active
  permission_level_weight eosio_prods_plw{
      {_registrator, "active"_n},
      1};

  owner_auth.accounts.push_back(eosio_prods_plw);
  active_auth.accounts.push_back(eosio_prods_plw);
  
  action(permission_level(_registrator, "active"_n), "eosio"_n, "createaccnt"_n,
         std::tuple(coopname, braname, owner_auth, active_auth))
      .send();

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(braname.value);

  eosio::check(account == accounts.end(), "Аккаунт уже зарегистририван");
  
  std::vector<eosio::name> storages;
  storages.push_back(coopname);

  accounts.emplace(RamPayer::of(accounts, coopname), [&](auto &n)
    {
      n.username = braname;
      n.status = "active"_n;
      n.type = "organization"_n;
      n.registrator = coopname;
      n.referer = ""_n;
      n.storages = storages;
      n.registered_at =
          eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
      n.meta = ""; 
    });
}