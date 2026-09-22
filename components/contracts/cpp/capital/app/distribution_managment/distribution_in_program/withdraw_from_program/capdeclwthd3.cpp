/**
 * @brief Отклоняет возврат из программы благороста советом
 * Отклоняет возврат из программы благороста советом и возвращает средства:
 * - Получает объект возврата
 * - Возвращает средства обратно в capital_available через capital_wallet
 * - Обновляет глобальное состояние (возвращает средства в доступные)
 * - Удаляет заявку
 * @param coopname Наименование кооператива
 * @param withdraw_hash Хеш заявки на возврат для отклонения
 * @param reason Причина отклонения возврата
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void capital::capdeclwthd3(name coopname, checksum256 withdraw_hash, std::string reason) {
  require_auth(_soviet);

  auto exist_withdraw = Capital::get_program_withdraw(coopname, withdraw_hash);
  eosio::check(exist_withdraw.has_value(), "Объект возврата не найден");
  
  Capital::program_withdraws_index program_withdraws(_capital, coopname.value);
  auto withdraw = program_withdraws.find(exist_withdraw->id);
  
  eosio::check(withdraw != program_withdraws.end(), "Объект возврата не найден");

  // Возвращаем средства обратно в capital_available через capital_wallet
  auto capital_wallet_opt = Capital::Wallets::get_capital_wallet_by_username(coopname, withdraw->username);
  if (capital_wallet_opt.has_value()) {
    Capital::capital_wallets_index capital_wallets(_capital, coopname.value);
    auto idx = capital_wallets.get_index<"byusername"_n>();
    auto wallet_itr = idx.find(withdraw->username.value);
    
    if (wallet_itr != idx.end()) {
      idx.modify(wallet_itr, RamPayer::of(idx, coopname), [&](auto &w) {
        w.capital_available += withdraw->amount;
      });
      
      // Обновляем глобальное состояние - возвращаем средства
      auto state = Capital::State::get_global_state(coopname);
      state.program_membership_distributed -= withdraw->amount;
      state.program_membership_available += withdraw->amount;
      Capital::State::update_global_state(state);
    }
  }

  // Удаляем заявку
  program_withdraws.erase(withdraw);
}