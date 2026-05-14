/**
 * @ingroup public_actions
 */
void wallet::createwthd(eosio::name coopname, eosio::name username, checksum256 withdraw_hash, eosio::asset quantity, document2 statement) {
  
  require_auth(coopname);

  Wallet::validate_asset(quantity);
  
  auto cooperative = get_cooperative_or_fail(coopname);
  cooperative.check_symbol_or_fail(quantity);
  
  auto withdraw = Wallet::get_withdraw(coopname, withdraw_hash);
  eosio::check(!withdraw.has_value(), "Объект возврата уже существует с указанным хэшем");
  
  uint64_t id = get_global_id(_wallet, "withdraws"_n);

  Wallet::withdraws_index withdraws(_wallet, coopname.value);
    
  withdraws.emplace(coopname, [&](auto &d) {
    d.id = id;
    d.withdraw_hash = withdraw_hash;
    d.username = username;
    d.coopname = coopname;
    d.statement = statement;
    d.quantity = quantity;
    d.status = "pending"_n;
    d.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

  ::Soviet::create_agenda(
    _wallet,
    coopname,
    username,
    get_valid_soviet_action("createwthd"_n),
    withdraw_hash,
    _wallet, // callback_contract (текущий контракт)
    Wallet::get_valid_wallet_action("authwthd"_n), // callback_action_approve
    Wallet::get_valid_wallet_action("declinewthd"_n), // callback_action_decline
    statement,
    std::string("")
  );
  
  std::string memo_in = "Возврат части целевого паевого взноса по ЦПП 'Цифровой Кошелёк'";

  // ledger2: BLOCK на w.wal.share — резервируем сумму под рассмотрение заявки.
  Ledger2::apply(_wallet, coopname, operations::wallet::REQUEST_WITHDRAW, quantity,
                 username, withdraw_hash, memo_in);
};

