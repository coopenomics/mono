/**
 * @brief Добавление пайщика в кооператив
 * Добавляет действующего пайщика в систему, пропуская этап подписания заявления на вступление.
 * Позволяет установить дату регистрации и распределить взносы по фондам.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param braname Наименование филиала
 * @param type Тип участника
 * @param created_at Дата создания
 * @param initial Сумма вступительного взноса
 * @param minimum Сумма минимального взноса
 * @param spread_initial Флаг распределения вступительного взноса
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::addpartcpnt(eosio::name coopname, eosio::name username, eosio::name braname, eosio::name type, eosio::time_point_sec created_at, eosio::asset initial, eosio::asset minimum, bool spread_initial) {
  check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);

  eosio::check(account != accounts.end(), "Аккаунт не найден");
  
  participants_index participants(_soviet, coopname.value);
  
  participants.emplace(RamPayer::of(participants, coopname), [&](auto &m){
    m.username = username;
    m.braname = braname;
    m.created_at = created_at;
    m.last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    m.last_min_pay = created_at;
    m.status = "accepted"_n;
    m.is_initial = true;
    m.is_minimum = true;
    m.has_vote = true;    
    m.type = type;
    m.minimum_amount = minimum; 
    m.initial_amount = initial;
  });

}
