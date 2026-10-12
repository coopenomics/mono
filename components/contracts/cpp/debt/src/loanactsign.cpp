/**
 * @brief Пайщик подписал акт передачи имущественного права в залог.
 *
 * Акт с подписями председателя и пайщика закрывает оформление залога. Сумма
 * займа начисляется пайщику к выдаче (Дт 58 / Кт 76), платёж передаётся
 * кассиру с назначением «заём по договору № …».
 *
 * @param coopname Наименование кооператива
 * @param username Пайщик-заёмщик
 * @param debt_hash Хэш займа
 * @param act Акт передачи права в залог с подписями председателя и пайщика
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::loanactsign(eosio::name coopname, eosio::name username, checksum256 debt_hash, document2 act) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.username == username, "Заём принадлежит другому пайщику");
  eosio::check(d.status == Debt::Status::SIGNED, "Акт подписывается после подписи договора председателем");
  eosio::check(Debt::Core::has_doc(d.act), "Акт ещё не подписан председателем");
  const eosio::name chairman = Debt::Core::chairman_of(coopname);

  eosio::check(!is_empty_document(act), "Нужен акт с подписью пайщика");
  eosio::check(act.hash == d.act.value().hash, "Пайщик подписывает тот же акт, что подписал председатель");
  verify_document_or_fail(act, {chairman, username});
  verify_signer_keys_or_fail(act, chairman);
  verify_signer_keys_or_fail(act, username);

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.status = Debt::Status::PAYING;
    row.act.emplace(act);
    row.last_pay_error.clear();
  });
  Debt::Core::link_document(coopname, username, debt_hash, act);

  Ledger2::apply(_debt, coopname, operations::debt::ACCRUE, processes::debt::LOAN, d.amount, username, debt_hash,
                 Debt::Memo::get_accrue_memo(debt_hash));
  Debt::Core::send_payout(coopname, d);

  require_recipient(username);
  require_recipient(coopname);
}
