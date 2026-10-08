/**
 * @brief Председатель подписал договор займа.
 *
 * Сумма займа начисляется пайщику к выдаче (Дт 58 / Кт 76), платёж передаётся
 * кассиру с назначением «заём по договору № …».
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void debt::loansigned(eosio::name coopname, eosio::name username, checksum256 debt_hash, document2 signed_contract) {
  require_auth(_soviet);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::AUTHORIZED, "Договор подписывается после решения совета");
  // username — председатель, подтвердивший одобрение: совет передаёт его имя, не имя заёмщика.
  eosio::check(!is_empty_document(signed_contract), "Нужен договор с подписью председателя");
  eosio::check(signed_contract.hash == d.contract.hash, "Председатель подписывает тот же договор, что подписал пайщик");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.status = Debt::Status::PAYING;
    row.signed_contract = signed_contract;
    row.last_pay_error.clear();
  });

  Ledger2::apply(_debt, coopname, operations::debt::ACCRUE, processes::debt::LOAN, d.amount, d.username, debt_hash,
                 Debt::Memo::get_accrue_memo(debt_hash));

  Debt::Core::send_payout(coopname, d);

  require_recipient(d.username);
  require_recipient(coopname);
}
