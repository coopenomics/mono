/**
 * @ingroup public_actions
 *
 * Создаёт заявку кооператива на инвестирование собственных средств
 * (с расчётного счёта) в ЦПП кооператива-оператора платформы и ставит
 * вопрос на повестку совета. Источник средств — банковский счёт (51),
 * который не имеет wallet-зеркала в ledger2, поэтому резервирование
 * на этапе заявки не выполняется — единственная учётная операция
 * (Дт 58 / Кт 51) проводится в completeinv после подтверждения
 * исходящего платежа кассиром.
 */
void wallet::createinv(eosio::name coopname, checksum256 invest_hash, eosio::asset quantity, document2 statement) {

  require_auth(coopname);

  Wallet::validate_asset(quantity);
  check(quantity.amount > 0, "Сумма инвестирования должна быть положительной");

  auto cooperative = get_cooperative_or_fail(coopname);
  cooperative.check_symbol_or_fail(quantity);

  auto exist_investment = Wallet::get_investment(coopname, invest_hash);
  eosio::check(!exist_investment.has_value(), "Объект инвестирования уже существует с указанным хэшем");

  uint64_t id = get_global_id(_wallet, "investments"_n);

  Wallet::investments_index investments(_wallet, coopname.value);

  investments.emplace(coopname, [&](auto &d) {
    d.id = id;
    d.invest_hash = invest_hash;
    d.coopname = coopname;
    d.statement = statement;
    d.quantity = quantity;
    d.status = "pending"_n;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

  ::Soviet::create_agenda(
    _wallet,
    coopname,
    coopname,
    get_valid_soviet_action("createinv"_n),
    invest_hash,
    _wallet, // callback_contract (текущий контракт)
    Wallet::get_valid_wallet_action("authinv"_n), // callback_action_approve
    Wallet::get_valid_wallet_action("declineinv"_n), // callback_action_decline
    statement,
    std::string("")
  );
};
