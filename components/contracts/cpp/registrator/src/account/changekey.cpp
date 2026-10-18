
/**
 * @brief Изменение ключа активной учетной записи.
 * Изменяет активный ключ указанной учетной записи
 * @param coopname Наименование кооператива
 * @param changer Имя аккаунта, который изменяет ключ
 * @param username Имя аккаунта, ключ которого требуется изменить
 * @param public_key Новый публичный ключ для активной учетной записи
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p changer
 */
void registrator::changekey(eosio::name coopname, eosio::name changer, eosio::name username,
                                              eosio::public_key public_key)
{
  require_auth(coopname);

  auto cooperative = get_cooperative_or_fail(coopname);
  check_auth_or_fail(_registrator, coopname, changer, "changekey"_n);
  
  accounts_index accounts(_registrator, _registrator.value);

  auto participant = get_participant_or_fail(coopname, username);
  eosio::check(participant.status == "accepted"_n, "Пайщик не активен в кооперативе");
  
  eosio::check(cooperative.status.value() == "active"_n, "Кооператив не активен и не может изменять ключи доступа");
  
  auto coop_account = accounts.find(username.value);
  eosio::check(coop_account != accounts.end(), "Аккаунт кооператива не найден");
  
  authority active_auth;
  active_auth.threshold = 1;
  key_weight keypermission{public_key, 1};
  active_auth.keys.emplace_back(keypermission);

  // Выпущен ключ узла (`setplatform`) — делегирование `username@platform`
  // остаётся в `active`: восстановление доступа пайщика не должно останавливать
  // узел кооператива.
  Registrator::platforms_index platforms(_registrator, _registrator.value);
  if (platforms.find(username.value) != platforms.end()) {
    active_auth.accounts.emplace_back(
        permission_level_weight{eosio::permission_level(username, "platform"_n), 1});
  }

  // Change active authority of card to a new key
  eosio::action(eosio::permission_level(_registrator, eosio::name("active")),
                eosio::name("eosio"), eosio::name("changekey"),
                std::tuple(username, eosio::name("active"),
                           eosio::name("owner"), active_auth))
      .send();

}
