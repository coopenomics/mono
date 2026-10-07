/**
 * @brief Возврат займа деньгами с главного кошелька пайщика.
 *
 * Возврат разрешён досрочно, целиком или частью. Сумма списывается с главного
 * кошелька (Дт 80 / Кт 58) и с кошелька выданных займов, обеспечение на ту же
 * сумму возвращается в программу. При нулевом остатке заём закрыт.
 *
 * @param statement Заявление о возврате займа в свободной форме с подписью пайщика
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::repayloan(eosio::name coopname, eosio::name username, checksum256 debt_hash, eosio::asset amount,
                     document2 statement) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.username == username, "Заём принадлежит другому пайщику");
  eosio::check(d.status == Debt::Status::ISSUED || d.status == Debt::Status::OVERDUE, "Вернуть можно выданный заём");
  eosio::check(d.source == _debt, "Возврат деньгами займа другого приложения появится позже");

  Wallet::validate_asset(amount);
  eosio::check(amount.symbol == d.remaining.symbol, "Валюта возврата не совпадает с валютой займа");
  eosio::check(amount <= d.remaining, "Сумма возврата больше остатка займа");
  eosio::check(!is_empty_document(statement), "Нужно заявление о возврате займа с подписью пайщика");
  verify_document_or_fail(statement, {username});
  verify_signer_keys_or_fail(statement, username);

  eosio::asset available = Ledger2::get_user_available(coopname, ledger2_wallets::SHARE_FUND_PAY, username);
  eosio::check(available >= amount, "Недостаточно средств на главном кошельке пайщика");

  Ledger2::apply(_debt, coopname, operations::debt::REPAY, processes::debt::LOAN, amount, username, debt_hash,
                 Debt::Memo::get_repay_memo(debt_hash));
  Ledger2::apply(_debt, coopname, operations::debt::CLOSE, processes::debt::LOAN, amount, username, debt_hash,
                 Debt::Memo::get_close_memo(debt_hash));

  const auto& c = Debt::get_collateral_or_fail(d.collateral);
  eosio::asset release = amount < d.pledged ? amount : d.pledged;
  Debt::Core::unpledge(c, coopname, username, release, debt_hash);

  Debt::Core::change_summary(coopname, username, -amount);

  eosio::asset remaining = d.remaining - amount;
  if (remaining.amount == 0) {
    // Остаток обеспечения сверх займа (не возникает при обеспечении один к одному) тоже возвращается.
    Debt::Core::unpledge(c, coopname, username, d.pledged - release, debt_hash);
    Debt::Core::erase_debt(coopname, d.id);
  } else {
    Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
      row.remaining = remaining;
      row.pledged -= release;
    });
  }

  require_recipient(username);
  require_recipient(coopname);
}
