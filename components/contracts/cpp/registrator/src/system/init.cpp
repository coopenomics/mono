/**
 * @brief Инициализация контракта регистратора.
 * Создает начальные аккаунты и кооператив-провайдер системы
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p system
 */
[[eosio::action]] void registrator::init()
{
  require_auth(_system);

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(_provider.value);
  eosio::check(account == accounts.end(), "Контракт регистратора уже инициализирован для указанного провайдера");

  std::vector<eosio::name> storages;
  storages.push_back(_provider);

  // accounts.emplace(_system, [&](auto &n)
  // {
  //     n.type = "individual"_n;
  //     n.storages = storages;
  //     n.username = _provider_chairman;
  //     n.status = "active"_n;
  //     n.registrator = _system;
  //     n.referer = ""_n;
  //     n.registered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()); 
  // });

  accounts.emplace(RamPayer::of(accounts), [&](auto &n)
  {
      n.type = "organization"_n;
      n.storages = storages;
      n.username = _provider;
      n.status = "active"_n;
      n.registrator = _system;
      n.referer = ""_n;
      n.registered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()); 
  });

  cooperatives2_index coops(_registrator, _registrator.value);
  eosio::check(_provider_initial.symbol == _provider_minimum.symbol && _provider_minimum.symbol == _root_govern_symbol, "Неверные символы для взносов");
  eosio::check(_provider_org_initial.symbol == _provider_org_minimum.symbol && _provider_org_minimum.symbol == _root_govern_symbol, "Неверные символы для взносов");

  eosio::check(_provider_org_initial.amount > 0 && _provider_org_minimum.amount > 0 && _provider_initial.amount > 0 && _provider_minimum.amount > 0, "Вступительный и минимальный паевые взносы должны быть положительными");


  coops.emplace(RamPayer::of(coops), [&](auto &org)
  {
    org.username = _provider;
    org.is_cooperative = true;
    org.coop_type = "conscoop"_n;
    org.initial = _provider_initial;
    org.minimum = _provider_minimum;
    org.registration = _provider_initial + _provider_minimum; 

    org.org_initial = _provider_org_initial;
    org.org_minimum = _provider_org_minimum;
    org.org_registration = _provider_org_initial + _provider_org_minimum; 
    
    org.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()); 
    org.status = "active"_n;
  });

};
