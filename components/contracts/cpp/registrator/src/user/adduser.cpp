/**
 * @brief Добавление пайщика.
 * Создает новый аккаунт и добавляет пайщика в кооператив
 * @param coopname Наименование кооператива
 * @param referer Имя реферера
 * @param username Имя пользователя для создания
 * @param type Тип пользователя (individual, entrepreneur, organization)
 * @param created_at Дата создания аккаунта
 * @param initial Вступительный взнос
 * @param minimum Минимальный взнос
 * @param spread_initial Флаг распределения вступительного взноса
 * @param meta Метаданные пользователя
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void registrator::adduser(
    eosio::name coopname, eosio::name referer, 
    eosio::name username, eosio::name type , eosio::time_point_sec created_at, 
    eosio::asset initial, eosio::asset minimum, bool spread_initial, std::string meta)
{
  require_auth(coopname);
  
  get_cooperative_or_fail(coopname);
  
  eosio::check(_root_govern_symbol == initial.symbol, "Неверный символ");
  eosio::check(_root_govern_symbol == minimum.symbol, "Неверный символ");
  
  eosio::check(created_at.sec_since_epoch() <= eosio::current_time_point().sec_since_epoch(), "Дата created_at должна быть в прошлом" );
  
  authority active_auth;
  active_auth.threshold = 1; 

  authority owner_auth;
  owner_auth.threshold = 1;

  // Устанавливаем разрешение eosio.prods@active для владельца
  permission_level_weight eosio_prods_plw{{_registrator, "active"_n},1};
  owner_auth.accounts.push_back(eosio_prods_plw);

  // Добавьте пустые ключи в active_auth
  active_auth.accounts.push_back(eosio_prods_plw);
  
  // регистрируем аккаунт  
  action(permission_level(_registrator, "active"_n), "eosio"_n, "createaccnt"_n,
         std::tuple(coopname, username, owner_auth, active_auth))
  .send();
  
  accounts_index accounts(_registrator, _registrator.value);
  
  auto card = accounts.find(username.value);

  eosio::check(card == accounts.end(), "Аккаунт уже зарегистририван");

  eosio::check(type == "individual"_n || type == "entrepreneur"_n || type == "organization"_n, "Неверный тип пользователя, допустимы только: individual, entrepreneur и organization.");
  
  std::vector<eosio::name> storages;
  
  storages.push_back(coopname);

  accounts.emplace(coopname, [&](auto &n)
    {
      n.username = username;
      n.status = "active"_n;
      n.registrator = coopname;
      n.referer = referer;
      n.type = type;
      n.storages = storages; 
      n.registered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
      n.meta = meta; 
    });
    
  std::string memo = "Минимальный паевой взнос при вступлении пайщика с username=" + username.to_string();
  std::string username_str = username.to_string();
  checksum256 username_hash = eosio::sha256(username_str.data(), username_str.size());
  
  // Минимальный паевой взнос через ledger2 (ISSUE в SHARE_FUND, Dr: BANK_ACCOUNT, Cr: SHARE_FUND)
  Ledger2::apply(_registrator, coopname, ledger2_ops::INITIAL_SHARE, minimum, username, username_hash, memo);

  if (spread_initial) {
    memo = "Вступительный взнос при вступлении пайщика с username=" + username.to_string();
    // Вступительный взнос через ledger2 (ISSUE в ENTRANCE_FEES, Dr: BANK_ACCOUNT, Cr: ENTRANCE_FEES)
    Ledger2::apply(_registrator, coopname, ledger2_ops::ENTRANCE_FEE, initial, username, username_hash, memo);
  }
  
  // Увеличиваем счётчик активных пайщиков
  cooperatives2_index cooperatives(_registrator, _registrator.value);
  auto coop_itr = cooperatives.find(coopname.value);
  if (coop_itr != cooperatives.end() && coop_itr->is_cooperative) {
    cooperatives.modify(coop_itr, coopname, [&](auto &coop) {
      if (coop.active_participants_count.has_value()) {
        coop.active_participants_count = coop.active_participants_count.value() + 1;
      } else {
        coop.active_participants_count = 1;
      }
    });
  }
  
  eosio::name braname = ""_n;
  
  action(permission_level{_registrator, "active"_n}, _soviet, "addpartcpnt"_n,
     std::make_tuple(coopname, username, braname, type, created_at, initial, minimum, spread_initial))
  .send();
  
}
