/**
 * @brief Председатель подписал договор займа.
 *
 * Обратный вызов запроса одобрения. Той же транзакцией председатель подписал
 * договор залога и акт (loanchsign); заём ждёт подписи акта пайщиком, после
 * неё сумма начисляется к выдаче и уходит кассиру (loanactsign).
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
  eosio::check(Debt::Core::has_doc(d.signed_pledge_contract) && Debt::Core::has_doc(d.act),
               "Вместе с договором председатель подписывает договор залога и акт передачи права в залог");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.status = Debt::Status::SIGNED;
    row.signed_contract = signed_contract;
  });

  require_recipient(d.username);
  require_recipient(coopname);
}
