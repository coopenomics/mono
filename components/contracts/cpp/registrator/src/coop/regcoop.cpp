/**
 * @brief Регистрация кооператива-члена цифровой системы.
 * Регистрирует новый кооператив в системе
 * @param coopname Наименование кооператива
 * @param username Имя пользователя-регистратора
 * @param params Параметры кооператива
 * @param document Документ регистрации
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p coopname или @p username
 */
[[eosio::action]] void registrator::regcoop(eosio::name coopname, eosio::name username, org_data params, document2 document)
{
  check_auth_or_fail(_registrator, coopname, username, "regcoop"_n);
  
  eosio::name payer = username;

  get_cooperative_or_fail(_provider);

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(coopname.value);
  eosio::check(account != accounts.end(), "Участник не найден в картотеке аккаунтов");
  
  eosio::check(account -> type != ""_n, "Аккаунт не переведен в статус пользователя (reguser)");
  
  eosio::check(account->type == "organization"_n, "Только организация может быть подключена к системе");

  cooperatives2_index coops(_registrator, _registrator.value);
  eosio::check(params.initial.symbol == params.minimum.symbol && params.initial.symbol == _root_govern_symbol, "Неверные символы для взносов");
  eosio::check(params.org_initial.symbol == params.org_minimum.symbol && params.org_initial.symbol == _root_govern_symbol, "Неверные символы для взносов");
  eosio::check(params.initial.amount > 0 && params.org_initial.amount > 0 && params.minimum.amount > 0 && params.org_minimum.amount > 0, "Вступительный и минимальный паевые взносы должны быть положительными");

  eosio::check(params.is_cooperative == true, "Только кооператив может быть подключен к системе");

  auto coop_itr = coops.find(coopname.value);

  if (coop_itr == coops.end()) {
    // Создаем новый кооператив
    coops.emplace(RamPayer::of(coops, coopname), [&](auto &org)
      {
        org.username = coopname;
        org.is_cooperative = params.is_cooperative;
        org.coop_type = params.coop_type;
        org.announce = params.announce;
        org.description = params.description;
        org.registration = params.initial + params.minimum;
        org.initial = params.initial;
        org.minimum = params.minimum;
        org.org_registration = params.org_initial + params.org_minimum;
        org.org_initial = params.org_initial;
        org.org_minimum = params.org_minimum;
        org.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
        org.status = "pending"_n;
        org.document = document;
      });
        
  } else {
    // Обновляем существующий кооператив, сохраняя текущий статус
    coops.modify(coop_itr, RamPayer::of(coops, coopname), [&](auto &org)
      {
        org.is_cooperative = params.is_cooperative;
        org.coop_type = params.coop_type;
        org.announce = params.announce;
        org.description = params.description;
        org.registration = params.initial + params.minimum;
        org.initial = params.initial;
        org.minimum = params.minimum;
        org.org_registration = params.org_initial + params.org_minimum;
        org.org_initial = params.org_initial;
        org.org_minimum = params.org_minimum;
        // Сохраняем существующий статус
        // org.status остается без изменений
        org.document = document;
      });
  }
    
  // Фиксируем документ в реестре
  checksum256 hash = eosio::sha256((char*)&coopname, sizeof(coopname));

  Soviet::make_complete_document(
    _registrator,
    _provider,
    coopname,
    "regcoop"_n,
    hash,
    document
  );
}
