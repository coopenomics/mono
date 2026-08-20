/**
 * @brief Верификация личности пайщика при личной явке.
 * Личность сверяется с паспортом уполномоченным лицом кооператива и фиксируется
 * в аккаунте пайщика. Верификацию проводит либо кооперативный участок
 * (председатель участка или его доверенное лицо) — тогда @p braname указан,
 * либо совет кооператива (председатель совета или сотрудник с правом на действие) —
 * тогда @p braname пуст. Верификация проводится один раз для каждой процедуры.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка; пусто, если верифицирует совет кооператива
 * @param verificator Кто проводит верификацию
 * @param username Имя аккаунта пайщика, который подлежит верификации
 * @param procedure Процедура верификации (passport)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p verificator либо от кооператива
 */
[[eosio::action]] void registrator::verifyacc(eosio::name coopname, eosio::name braname, eosio::name verificator, eosio::name username, eosio::name procedure)
{
  // Подписать может сам верификатор либо кооператив от его имени: личные ключи
  // пайщиков хранятся у них, а не на сервере, поэтому рабочие столы отправляют
  // действие подписью кооператива, проверив полномочия верификатора у себя.
  if (!has_auth(coopname))
    require_auth(verificator);

  eosio::check(is_personal_verification_procedure(procedure), "Эта процедура верификации не проводится при личной явке");

  // Полномочия зависят от того, кто верифицирует: участок отвечает за своих
  // пайщиков через таблицу доверенных лиц, совет кооператива — через права совета.
  if (braname) {
    auto branch = get_branch_or_fail(coopname, braname);
    eosio::check(branch.is_user_authorized(verificator), "Верификацию проводит председатель кооперативного участка или его доверенное лицо");
  } else {
    check_auth_or_fail(_registrator, coopname, verificator, "verifyacc"_n);
  }

  auto participant = get_participant_or_fail(coopname, username);
  eosio::check(participant.is_active(), "Пайщик не является действующим членом кооператива");

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");

  for (const auto& ver : account->verifications) {
    eosio::check(!(ver.procedure == procedure && ver.is_verified), "Верификация по этой процедуре уже проведена");
  }

  accounts.modify(account, eosio::same_payer, [&](auto &a)
  {
    verification new_verification {
      .verificator = verificator,
      .is_verified = true,
      .procedure = procedure,
      .created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()),
      .last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()),
      // Контекст проведения: "coopname/braname" у участка, "coopname/" у совета кооператива.
      .notice = coopname.to_string() + "/" + braname.to_string()
    };

    a.verifications.push_back(new_verification);
  });
}
