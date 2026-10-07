/**
 * @brief Согласование обеспечения займа паевым взносом «Благорост».
 *
 * Контракт займов зовёт это действие перед каждым движением обеспечения
 * пайщика (блокировка, возврат, обращение в пользу кооператива). Благорост
 * проверяет, что пайщик состоит в программе по подписанному договору об
 * участии, и пересчитывает его начисления по программе на текущий остаток —
 * иначе распределение за прошедший период посчиталось бы от остатка после
 * перевода.
 *
 * @param coopname Наименование кооператива
 * @param username Пайщик-заёмщик
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от контракта из белого списка (debt)
 */
void capital::pledgesync(eosio::name coopname, eosio::name username) {
  check_auth_and_get_payer_or_fail(contracts_whitelist);

  auto contributor = Capital::Contributors::get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Пайщик не состоит в программе «Благорост»");
  eosio::check(contributor->status == Capital::Contributors::Status::ACTIVE,
               "Договор об участии в хозяйственной деятельности пайщика не действует");
  eosio::check(contributor->is_external_contract || !is_empty_document(contributor->contract),
               "Договор об участии в хозяйственной деятельности пайщиком не подписан");

  // Пересчёт начислений возможен только при ненулевом остатке в программе:
  // у пайщика, заложившего всё, пересчитывать нечего.
  eosio::asset share_balance = Capital::Core::get_capital_program_user_share_balance(coopname, username);
  if (share_balance.amount > 0) {
    Capital::Core::refresh_contributor_program_rewards(coopname, username);
  }
}
