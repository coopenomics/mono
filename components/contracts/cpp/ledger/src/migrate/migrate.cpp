/**
 * @brief Миграция данных из контракта fund
 * Переносит данные из фондов fund в счета ledger
 */
void ledger::migrate(){
  require_auth(_ledger);
  
  // Получаем все кооперативы
  cooperatives2_index coops(_registrator, _registrator.value);
  
  for (auto coop_iter = coops.begin(); coop_iter != coops.end(); ++coop_iter) {
    eosio::name coopname = coop_iter->username;
    
    // Проверяем что счета еще не инициализированы
    laccounts_index accounts(_ledger, coopname.value);
    auto existing = accounts.begin();
    if (existing != accounts.end()) {
      continue; // Пропускаем уже инициализированные кооперативы
    }

    // Инициализируем все счета с нулевыми значениями
    for (const auto& account_data : ACCOUNT_MAP) {
      uint64_t id = std::get<0>(account_data);
      std::string name = std::get<1>(account_data);

      accounts.emplace(_ledger, [&](auto& acc) {
        acc.id = id;
        acc.name = name;
        acc.allocation = eosio::asset(0, _root_govern_symbol);
        acc.writeoff = eosio::asset(0, _root_govern_symbol);
      });
    }

    // Мигрируем данные из fund контракта
    // Читаем кошелек кооператива
    coopwallet_index coopwallets(_fund, coopname.value);
    auto wallet_iter = coopwallets.find(0); // ID всегда 0
    
    if (wallet_iter != coopwallets.end()) {
      // Паевой фонд (circulating_account) -> счет 80
      auto account_iter = accounts.find(80);
      if (account_iter != accounts.end()) {
        accounts.modify(account_iter, _ledger, [&](auto& acc) {
          acc.allocation = wallet_iter->circulating_account.available;
        });
      }

      // Вступительные взносы (initial_account) -> счет 801  
      account_iter = accounts.find(801);
      if (account_iter != accounts.end()) {
        accounts.modify(account_iter, _ledger, [&](auto& acc) {
          acc.allocation = wallet_iter->initial_account.available;
        });
      }

      // Накопительный счет членских взносов (accumulative_expense_account) -> счет 86
      account_iter = accounts.find(86);
      if (account_iter != accounts.end()) {
        accounts.modify(account_iter, _ledger, [&](auto& acc) {
          acc.allocation = wallet_iter->accumulative_expense_account.available;
        });
      }
    }
  }
} 