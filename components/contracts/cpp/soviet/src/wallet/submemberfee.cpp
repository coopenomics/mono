/**
 * @brief Списание членского взноса из кошелька программы
 * Списывает членский взнос из кошелька участника по конкретной программе.
 * Обновляет членские взносы участника и агрегированные показатели программы.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param program_id Идентификатор программы
 * @param quantity Количество средств для списания
 * @param memo Примечание к операции
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::submemberfee(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo){
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);  
  
  programs_index programs(_soviet, coopname.value);
  auto prg = programs.find(program_id);
  eosio::check(prg != programs.end(), "Программа с указанным program_id не найдена");
  
  auto participant = get_participant_or_fail(coopname, username);
  auto exist_wallet = get_user_program_wallet_or_fail(coopname, username, program_id);
  
  progwallets_index progwallets(_soviet, coopname.value);
  auto wallet = progwallets.find(exist_wallet.id);
  
  // Проверяем, что текущий баланс не станет меньше нуля
  auto current_contribution = wallet->membership_contribution.has_value() ? wallet->membership_contribution.value() : asset(0, quantity.symbol);
  eosio::check(current_contribution >= quantity, "Недостаточно средств для списания членского взноса");
  
  progwallets.modify(wallet, RamPayer::of(progwallets, coopname), [&](auto &p) { 
    p.membership_contribution = current_contribution - quantity;
  });
  
  // Обновляем агрегированный баланс в самой программе (program_id)
  auto current_program_contributions = prg->membership_contributions.has_value() ? prg->membership_contributions.value() : asset(0, quantity.symbol);
  eosio::check(current_program_contributions >= quantity, "Недостаточно средств в программе для списания");
  
  programs.modify(prg, RamPayer::of(programs, coopname), [&](auto &p){
    p.membership_contributions = current_program_contributions - quantity;
  });
} 