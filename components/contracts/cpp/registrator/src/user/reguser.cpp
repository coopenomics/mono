/**
 * @brief Регистрация пользователя.
 * Регистрирует аккаунт в качестве физического лица для вступления в кооператив
 * @param coopname Наименование кооператива
 * @param braname Наименование филиала
 * @param username Имя пользователя, который регистрируется
 * @param type Тип пользователя (individual, entrepreneur, organization)
 * @param statement Документ заявления на вступление
 * @param registration_hash Хэш регистрации
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void registrator::reguser(eosio::name coopname, eosio::name braname, eosio::name username, eosio::name type, document2 statement, checksum256 registration_hash)
{
  require_auth(coopname);
  
  auto cooperative = get_cooperative_or_fail(coopname);
  
  accounts_index accounts(_registrator, _registrator.value);
  auto new_user = accounts.find(username.value);
  eosio::check(new_user != accounts.end(), "Участник не найден в картотеке аккаунтов");
  eosio::check(new_user -> type == ""_n, "Аккаунт уже получил карточку участника, повторное получение невозможно.");
  eosio::check(type == "individual"_n || type == "entrepreneur"_n || type == "organization"_n, "Неверный тип пользователя, допустимы только: individual, entrepreneur и organization.");
  
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  eosio::check(participant == participants.end(), "Участник уже является членом кооператива");
  
  std::vector<eosio::name> storages;
  storages.push_back(coopname);

  accounts.modify(new_user, coopname, [&](auto &c)
  {
    c.type = type;
    c.storages = storages;
  });
  
  eosio::asset minimum = asset(0, _root_govern_symbol);
  eosio::asset initial = asset(0, _root_govern_symbol); 
  
  if (type == "organization"_n) {
    minimum = cooperative.org_minimum.value();
    initial = cooperative.org_initial.value();
  } else {
    minimum = cooperative.minimum;
    initial = cooperative.initial;
  }
  
  // проверяем существование кооперативного участка
  if (braname != ""_n) get_branch_or_fail(coopname, braname);
  
  // Проверяем подпись документа
  verify_document_or_fail(statement);
  // Заявление о вступлении подписывает сам кандидат: транзакцию шлёт кооператив,
  // и без сверки ключа с аккаунтом чужой подписью можно было бы вступить за другого.
  verify_signer_keys_or_fail(statement, username);
  
  Registrator::candidates_index candidates(_registrator, coopname.value);
  auto candidate = candidates.find(username.value);
  eosio::check(candidate == candidates.end(), "Кандидат уже существует");
  
  candidates.emplace(coopname, [&](auto &c) {
    c.coopname = coopname;
    c.username = username;
    c.braname = braname;
    c.status = "created"_n;
    c.statement = statement;
    c.created_at = current_time_point();
    c.registration_hash = registration_hash;
    c.initial = initial;
    c.minimum = minimum;
  });
  
  Action::send<newpackage_interface>(
    _soviet,
    "newpackage"_n,
    _registrator,
    coopname,
    username,
    "joincoop"_n,
    registration_hash
  );

  
  // создаём объект входящего платежа в gateway с коллбэком после обработки
  action(permission_level{ _registrator, "active"_n}, _gateway, "createinpay"_n,
    std::make_tuple(
      coopname, 
      username, 
      registration_hash, 
      initial + minimum,
      _registrator, 
      "confirmpay"_n,
      "declinepay"_n
    )
  ).send();
}
