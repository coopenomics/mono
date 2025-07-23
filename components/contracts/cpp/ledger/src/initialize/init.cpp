/**
 * @brief Инициализация всех счетов кооператива согласно плану счетов
 * @param coopname - имя кооператива
 */
[[eosio::action]]
void ledger::init(eosio::name coopname) {
  require_auth(coopname);

  // Проверяем что кооператив существует
  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop_iter = coops.find(coopname.value);
  eosio::check(coop_iter != coops.end(), "Кооператив не найден");

  laccounts_index accounts(_ledger, coopname.value);

  // Проверяем что счета еще не инициализированы
  auto existing = accounts.begin();
  eosio::check(existing == accounts.end(), "Счета уже инициализированы для данного кооператива");

  // Инициализируем все счета из карты с нулевыми значениями
  for (const auto& account_data : ACCOUNT_MAP) {
    uint64_t id = std::get<0>(account_data);
    std::string name = std::get<1>(account_data);

    accounts.emplace(coopname, [&](auto& acc) {
      acc.id = id;
      acc.name = name;
      acc.allocation = eosio::asset(0, _root_govern_symbol);
      acc.writeoff = eosio::asset(0, _root_govern_symbol);
    });
  }
} 