/**
 * @brief Списание баланса из кошелька программы
 * Списывает средства из кошелька участника по конкретной программе.
 * Обновляет доступный баланс участника и агрегированные показатели программы.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param program_id Идентификатор программы
 * @param quantity Количество средств для списания
 * @param skip_available_check Флаг пропуска проверки достаточности средств
 * @param memo Примечание к операции
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::subbal(eosio::name coopname, eosio::name username, uint64_t program_id, eosio::asset quantity, bool skip_available_check, std::string memo) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  programs_index programs(_soviet, coopname.value);
  auto prg = programs.find(program_id);
  eosio::check(prg != programs.end(), "Программа с указанным program_id не найдена");
  
  auto cooperative = get_cooperative_or_fail(coopname);  
  auto participant = get_participant_or_fail(coopname, username);
  auto exist_wallet = get_user_program_wallet_or_fail(coopname, username, program_id);
  
  progwallets_index progwallets(_soviet, coopname.value);
  auto wallet = progwallets.find(exist_wallet.id);
  
  eosio::check(wallet != progwallets.end(), "Кошелёк программы у пользователя не найден");
  
  //обход проверки положительности при списании по флагу (необходимо для refund при уходе в минус)
  if (!skip_available_check)
    eosio::check(wallet ->available >= quantity, "Недостаточный баланс");
  
  progwallets.modify(wallet, RamPayer::of(progwallets, coopname), [&](auto &b) { 
    b.available -= quantity; 
  });
  
  // Уменьшаем агрегированный баланс в самой программе
  programs.modify(prg, RamPayer::of(programs, coopname), [&](auto &p){
    eosio::check(p.available.value() >= quantity, "В программе недостаточно доступных средств");
    eosio::check(p.share_contributions.value() >= quantity, "В программе недостаточно средств");
    
    p.available = p.available.value_or(asset(0, quantity.symbol)) - quantity;
    p.share_contributions = p.share_contributions.value_or(asset(0, quantity.symbol)) - quantity;
  });  
}