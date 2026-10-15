/**
 * @brief Блокировка баланса в кошельке программы
 * Блокирует средства в кошельке участника по конкретной программе.
 * Переводит средства из доступных в заблокированные.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param program_id Идентификатор программы
 * @param quantity Количество средств для блокировки
 * @param memo Примечание к операции
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::blockbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, std::string memo) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);  
  cooperative.check_symbol_or_fail(quantity);
  
  programs_index programs(_soviet, coopname.value);
  auto prg = programs.find(program_id);
  eosio::check(prg != programs.end(), "Программа с указанным program_id не найдена");
  
  auto participant = get_participant_or_fail(coopname, username);
  
  auto exist_wallet = get_user_program_wallet_or_fail(coopname, username, program_id);
  progwallets_index progwallets(_soviet, coopname.value);
  auto wallet = progwallets.find(exist_wallet.id);
  
  eosio::check(wallet -> available >= quantity, "Недостаточно средств на балансе для блокировки");

  progwallets.modify(wallet, RamPayer::of(progwallets, coopname), [&](auto &w){
    w.available -= quantity;
    w.blocked = w.blocked.value_or(asset(0, quantity.symbol)) + quantity;
  });
  
  eosio::check(prg -> available.value() >= quantity, "Недостаточно средств на балансе программы");
    
  programs.modify(prg, RamPayer::of(programs, coopname), [&](auto &p){
    p.available = p.available.value_or(asset(0, quantity.symbol)) - quantity;
    p.blocked = p.blocked.value_or(asset(0, quantity.symbol)) + quantity;
  });
  
}