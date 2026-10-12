/**
 * @brief Председатель подписал договор залога и акт передачи права в залог.
 *
 * Идёт одной транзакцией с подтверждением одобрения договора займа: по акту
 * пайщик передаёт кооперативу имущественное право, поэтому первую подпись под
 * актом ставит председатель, вторую — пайщик (loanactsign).
 *
 * @param coopname Наименование кооператива
 * @param debt_hash Хэш займа
 * @param signed_pledge_contract Договор залога с подписями пайщика и председателя
 * @param act Акт передачи права в залог с подписью председателя
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::loanchsign(eosio::name coopname, checksum256 debt_hash, document2 signed_pledge_contract, document2 act) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::AUTHORIZED, "Договор залога и акт подписываются после решения совета");
  eosio::check(Debt::Core::has_doc(d.pledge_contract), "К заявлению не приложен договор залога");
  eosio::check(!Debt::Core::has_doc(d.act), "Акт уже подписан председателем");
  const eosio::name chairman = Debt::Core::chairman_of(coopname);

  eosio::check(!is_empty_document(signed_pledge_contract), "Нужен договор залога с подписью председателя");
  eosio::check(signed_pledge_contract.hash == d.pledge_contract.value().hash,
               "Председатель подписывает тот же договор залога, что подписал пайщик");
  verify_document_or_fail(signed_pledge_contract, {d.username, chairman});
  verify_signer_keys_or_fail(signed_pledge_contract, chairman);

  eosio::check(!is_empty_document(act), "Нужен акт передачи права в залог с подписью председателя");
  verify_document_or_fail(act, {chairman});
  verify_signer_keys_or_fail(act, chairman);

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.signed_pledge_contract.emplace(signed_pledge_contract);
    row.act.emplace(act);
  });
  Debt::Core::link_document(coopname, d.username, debt_hash, signed_pledge_contract);

  require_recipient(d.username);
  require_recipient(coopname);
}
