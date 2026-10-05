/**
 * @brief Трансляция паевого взноса преподавателя из ЦПП «Образование» в
 * ЦПП «Цифровой Кошелёк».
 *
 * Принятый результат зачисляется преподавателю паевым взносом на кошелёк
 * программы — баланс его договора участия в хозяйственной деятельности
 * (`acceptrid`, o.edu.ridshr). Вернуть паевой взнос деньгами можно только с
 * Цифрового Кошелька, поэтому преподаватель сначала переводит туда весь
 * остаток или его часть своим заявлением (шаблон 3015; п. 5.3.1 договора), а
 * возврат оформляет уже штатным заявлением о возврате паевого взноса.
 *
 * Одна ledger2-операция:
 *  - `o.edu.wthshr` (TRANSFER w.edu.share → w.wal.share, без проводки — оба
 *    кошелька на счёте 80).
 *
 * Записи в RAM нет: заявление исполняется сразу и публикуется в реестр
 * документов.
 *
 * Guards:
 *  - заявление подписано пайщиком его ключом; пайщик — действующий член;
 *  - сумма положительна и не больше остатка паевого кошелька программы.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::wthshare(eosio::name coopname,
                         eosio::name username,
                         eosio::asset amount,
                         document2 statement) {
  require_auth(coopname);

  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "Сумма трансляции паевого взноса указывается в символе кооператива и больше нуля");
  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление о трансляции паевого взноса");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);

  auto bal_share = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::EDU_SHARE_FUND, username);
  eosio::check(bal_share.available >= amount,
               std::string{"Паевого взноса по программе недостаточно: на кошельке "} +
                 bal_share.available.to_string() + ", указано " + amount.to_string());

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::WITHDRAW_EDU_SHARE,
                 processes::edubridge::RID,
                 amount, username, statement.hash,
                 Edubridge::Memo::get_withdraw_share_memo());

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "wthshare"_n,
                                 statement.hash, statement);
}
