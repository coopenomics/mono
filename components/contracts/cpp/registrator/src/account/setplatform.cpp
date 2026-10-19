/**
 * @brief Выпуск разрешения `platform` аккаунта.
 *
 * Узел кооператива подписывает транзакции от имени аккаунта кооператива. Раньше
 * для этого в узел вводился активный ключ, а он принадлежит пайщику: при входе
 * по паролю пайщик ключа не видит, а восстановление доступа (`changekey`) его
 * меняет — и узел терял право подписи. `platform` — отдельный ключ узла:
 *   - `platform` создаётся с родителем `owner` (registrator), поэтому активным
 *     ключом пайщика его не удалить и не подменить;
 *   - `active` = {ключ пайщика, `username@platform`}: узел подписывает как
 *     `username@active` ключом `platform`, контракты и их проверки не меняются;
 *   - запись в `platforms` велит `changekey` сохранять делегирование.
 * Повторный выпуск заменяет ключ узла.
 *
 * @param coopname Кооператив, через который выпускается разрешение
 * @param username Аккаунт, которому выпускается разрешение
 * @param platform_key Публичный ключ узла
 * @param active_key Текущий ключ пайщика — остаётся в `active` рядом с `platform`
 * @ingroup public_actions
 * @ingroup public_registrator_actions
 *
 * @note Авторизация: сам аккаунт @p username либо кооператив @p coopname.
 */
void registrator::setplatform(eosio::name coopname, eosio::name username,
                              eosio::public_key platform_key, eosio::public_key active_key)
{
  // Сам аккаунт распоряжается своими ключами (узел при самостоятельной
  // миграции, пайщик из кабинета). Кооператив — только для действующего
  // пайщика: так ВОСХОД закрепляет ключ узла перед сменой ключа пайщика.
  if (!has_auth(username)) {
    require_auth(coopname);
    get_cooperative_or_fail(coopname);
    auto participant = get_participant_or_fail(coopname, username);
    eosio::check(participant.status == "accepted"_n,
                 "REGISTRATOR_PLATFORM_PARTICIPANT_INACTIVE: Пайщик не активен в кооперативе");
  }

  eosio::check(eosio::is_account(username), "REGISTRATOR_PLATFORM_ACCOUNT_NOT_FOUND: Аккаунт не найден");

  authority platform_auth;
  platform_auth.threshold = 1;
  platform_auth.keys.emplace_back(key_weight{platform_key, 1});

  // Сначала само разрешение: `active` ниже ссылается на него, а ссылку на
  // несуществующее разрешение цепь отвергает.
  eosio::action(eosio::permission_level(_registrator, "active"_n),
                "eosio"_n, "changekey"_n,
                std::tuple(username, "platform"_n, "owner"_n, platform_auth))
      .send();

  authority active_auth;
  active_auth.threshold = 1;
  active_auth.keys.emplace_back(key_weight{active_key, 1});
  active_auth.accounts.emplace_back(
      permission_level_weight{eosio::permission_level(username, "platform"_n), 1});

  eosio::action(eosio::permission_level(_registrator, "active"_n),
                "eosio"_n, "changekey"_n,
                std::tuple(username, "active"_n, "owner"_n, active_auth))
      .send();

  Registrator::platforms_index platforms(_registrator, _registrator.value);
  auto existing = platforms.find(username.value);
  if (existing == platforms.end()) {
    platforms.emplace(RamPayer::of(platforms), [&](auto &p) {
      p.username = username;
      p.coopname = coopname;
      p.public_key = platform_key;
      p.issued_at = eosio::current_time_point();
    });
  } else {
    platforms.modify(existing, RamPayer::of(platforms), [&](auto &p) {
      p.coopname = coopname;
      p.public_key = platform_key;
      p.issued_at = eosio::current_time_point();
    });
  }
}
