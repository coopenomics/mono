namespace Capital {

  /**
   * @brief Кошелек программы благороста для учёта CRPS и доступных средств от членских взносов
   * @ingroup public_tables
   * @ingroup public_capital_tables
   * 
   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): capwallets
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] capital_wallet {
    uint64_t id;                                    ///< ID кошелька (внутренний ключ)
    eosio::name coopname;                           ///< Имя кооператива
    eosio::name username;                           ///< Имя пользователя
    double last_program_crps = 0.0;                  ///< Последнее значение программной CRPS для членских взносов
    eosio::asset capital_available = asset(0, _root_govern_symbol); ///< Доступные средства от членских взносов для вывода
    
    uint64_t primary_key() const { return id; }     ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
  };
  
  typedef eosio::multi_index<
    "capwallets"_n, capital_wallet,
    indexed_by<"byusername"_n, const_mem_fun<capital_wallet, uint64_t, &capital_wallet::by_username>>
  > capital_wallets_index;

namespace Wallets {

  /**
   * Открыт ли у пайщика программный кошелёк ЦПП «Благорост»
   * (есть подписанное программное соглашение в `wallet::users.programs[]`).
   * Балансы читаются отдельно через ledger2::userwallets.
   */
  inline bool has_program_capital_wallet(eosio::name coopname, eosio::name username) {
    auto program_id = get_program_id(_capital_program);
    // Программа должна существовать в реестре кооператива.
    get_program_or_fail(coopname, program_id);
    return has_program_wallet(coopname, username, _capital_program);
  }

  /**
   * @brief Получает кошелек благороста по имени пользователя
   */
  inline std::optional<capital_wallet> get_capital_wallet_by_username(eosio::name coopname, eosio::name username) {
    capital_wallets_index capital_wallets(_capital, coopname.value);
    auto idx = capital_wallets.get_index<"byusername"_n>();
    
    auto itr = idx.find(username.value);
    if (itr == idx.end()) {
      return std::nullopt;
    }
    
    return capital_wallet(*itr);
  }

  /**
   * @brief Получает кошелек благороста или падает с ошибкой
   */
  inline capital_wallet get_capital_wallet_or_fail(eosio::name coopname, eosio::name username, const char* msg = "Кошелек благороста не найден") {
    auto wallet_opt = get_capital_wallet_by_username(coopname, username);
    eosio::check(wallet_opt.has_value(), msg);
    return wallet_opt.value();
  }
  
  /**
   * @brief Создает или обновляет кошелек благороста
   */
  inline void upsert_capital_wallet(eosio::name coopname, 
                                   eosio::name username, 
                                   int64_t last_program_crps, 
                                   eosio::asset capital_available) {
    capital_wallets_index capital_wallets(_capital, coopname.value);
    auto idx = capital_wallets.get_index<"byusername"_n>();
    
    auto itr = idx.find(username.value);
    if (itr == idx.end()) {
      // Создаем новый кошелек
      capital_wallets.emplace(coopname, [&](auto &w) {
        w.id = get_global_id_in_scope(_capital, coopname, "capwallets"_n);
        w.coopname = coopname;
        w.username = username;
        w.last_program_crps = last_program_crps;
        w.capital_available = capital_available;
      });
    } else {
      // Обновляем существующий
      idx.modify(itr, coopname, [&](auto &w) {
        if (last_program_crps != 0) w.last_program_crps = last_program_crps;
        if (capital_available.amount != 0) w.capital_available += capital_available;
      });
    }
  }

} //namespace Capital::Wallet
} // namespace Capital

