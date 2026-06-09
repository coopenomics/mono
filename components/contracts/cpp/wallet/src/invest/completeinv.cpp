/**
 * Callback gateway после подтверждения кассиром исходящего платежа
 * по инвестированию средств кооператива в ЦПП оператора платформы.
 * Проводит единственную учётную операцию процесса: Дт 58 / Кт 51,
 * ISSUE на кошелёк «Финансовые вложения в ЦПП оператора» (w.wal.invest).
 */
void wallet::completeinv(COMPLETEINV_SIGNATURE) {
  require_auth(_gateway);

  auto exist = Wallet::get_investment(coopname, invest_hash);
  check(exist.has_value(), "Объект процессинга не найден");

  Wallet::investments_index investments(_wallet, coopname.value);
  auto investment = investments.find(exist -> id);

  eosio::check(investment -> status == "authorized"_n, "Только принятые заявления на инвестирование могут быть обработаны");

  std::string memo_in = "Инвестирование средств кооператива в ЦПП оператора платформы";

  Ledger2::apply(_wallet, coopname, operations::wallet::COMPLETE_INVEST, investment -> quantity, coopname, invest_hash, memo_in);

  investments.erase(investment);
}
