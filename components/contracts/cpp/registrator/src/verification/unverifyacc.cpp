/**
 * @brief Отзыв верификации личности пайщика.
 * Председатель кооператива отзывает ранее проведённую верификацию
 * (ошибка при проведении или компрометация).
 * @param coopname Наименование кооператива
 * @param chairman Председатель кооператива
 * @param username Имя аккаунта пайщика
 * @param procedure Процедура верификации, которая отзывается
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p chairman или кооператива
 */
[[eosio::action]] void registrator::unverifyacc(eosio::name coopname, eosio::name chairman, eosio::name username, eosio::name procedure)
{
  check_auth_or_fail(_registrator, coopname, chairman, "unverifyacc"_n);

  eosio::check(is_branch_verification_procedure(procedure), "Отзыв доступен только для верификаций, проведённых кооперативным участком");

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");

  // Отзыв доступен только кооперативу, чей участок проводил верификацию:
  // контекст проведения записан в notice как "coopname/braname".
  const std::string coop_prefix = coopname.to_string() + "/";
  auto is_own_entry = [&](const verification& ver) {
    return ver.procedure == procedure &&
           ver.notice.rfind(coop_prefix, 0) == 0;
  };

  bool found = false;
  for (const auto& ver : account->verifications) {
    if (is_own_entry(ver)) {
      found = true;
      break;
    }
  }
  eosio::check(found, "Верификация по этой процедуре, проведённая вашим кооперативом, не найдена");

  accounts.modify(account, eosio::same_payer, [&](auto &a)
  {
    a.verifications.erase(
      std::remove_if(a.verifications.begin(), a.verifications.end(), is_own_entry),
      a.verifications.end());
  });
}
