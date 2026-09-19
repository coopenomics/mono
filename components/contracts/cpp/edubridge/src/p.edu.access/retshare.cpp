/**
 * @brief Перевод остатка кошелька ЦПП «Образование» в паевой взнос.
 *
 * Возвращённые ученику средства остаются членским взносом программы: их можно
 * потратить на другую подписку или, по заявлению ученика и согласованию
 * кооператива, вернуть в паевой взнос. Это второй путь того же Положения —
 * первый (сразу на паевой) применяется при отмене по недобору.
 *
 * Одна ledger2-операция:
 *  - `o.edu.retshr` (TRANSFER w.edu.member → w.wal.share, Дт 86 / Кт 80) —
 *    инверсия `o.edu.conv`.
 *
 * Guards:
 *  - amount > 0 в символе кооператива; заявление подписано пайщиком;
 *  - пайщик — действующий член кооператива;
 *  - w.edu.member.available пайщика >= amount.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::retshare(eosio::name coopname,
                         eosio::name username,
                         eosio::asset amount,
                         document2 statement) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма возврата в паевой взнос");
  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление о возврате членского взноса в паевой");
  verify_document_or_fail(statement, { username });

  get_participant_or_fail(coopname, username);

  auto bal_member = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::EDU_MEMBER_FEE, username);
  eosio::check(bal_member.available >= amount,
               std::string{"Недостаточно средств на кошельке программы: требуется "} +
                 amount.to_string() + ", доступно " + bal_member.available.to_string());

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::RETURN_TO_SHARE,
                 processes::edubridge::ACCESS,
                 amount, username, statement.hash,
                 Edubridge::Memo::get_return_to_share_memo());

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "retshare"_n,
                                 statement.hash, statement);
}
