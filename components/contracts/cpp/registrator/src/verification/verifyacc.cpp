/**
 * @brief Верификация личности пайщика на кооперативном участке.
 * Председатель кооперативного участка или его доверенное лицо лично сверяет
 * личность пайщика с паспортом и фиксирует факт верификации в аккаунте.
 * Верификация проводится один раз для каждой процедуры.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param verificator Кто проводит верификацию (председатель участка или доверенное лицо)
 * @param username Имя аккаунта пайщика, который подлежит верификации
 * @param procedure Процедура верификации (passport)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p verificator
 */
[[eosio::action]] void registrator::verifyacc(eosio::name coopname, eosio::name braname, eosio::name verificator, eosio::name username, eosio::name procedure)
{
  require_auth(verificator);

  eosio::check(is_branch_verification_procedure(procedure), "Эта процедура верификации не проводится на кооперативном участке");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(verificator), "Верификацию проводит председатель кооперативного участка или его доверенное лицо");

  auto participant = get_participant_or_fail(coopname, username);
  eosio::check(participant.is_active(), "Пайщик не является действующим членом кооператива");

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");

  for (const auto& ver : account->verifications) {
    eosio::check(!(ver.procedure == procedure && ver.is_verified), "Верификация по этой процедуре уже проведена");
  }

  accounts.modify(account, verificator, [&](auto &a)
  {
    verification new_verification {
      .verificator = verificator,
      .is_verified = true,
      .procedure = procedure,
      .created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()),
      .last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch()),
      .notice = coopname.to_string() + "/" + braname.to_string()
    };

    a.verifications.push_back(new_verification);
  });
}
