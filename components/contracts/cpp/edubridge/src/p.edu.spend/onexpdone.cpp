/**
 * @brief Коллбэк шасси расходов — расход программы завершён (p.edu.spend).
 *
 * Приходит inline-вызовом из шасси на терминальном переходе служебной
 * записки: совет отклонил расход либо расход закрыт после отчёта. Всё, что из
 * выделенных средств не было потрачено, возвращается в фонд программы
 * (o.edu.expunf) и снова становится свободным:
 *  - отклонение — возвращается вся сумма (оплат до отклонения быть не может);
 *  - закрытие — разница между выделенным и фактически потраченным.
 *
 * Расход завершён — запись программы стирается из RAM, история движений
 * остаётся в журнале действий.
 *
 * Guards:
 *  - require_auth(_expense) — вызывает только шасси расходов;
 *  - расход найден по идентификатору записки;
 *  - потрачено не больше, чем было выделено.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::onexpdone(eosio::name coopname,
                          eosio::checksum256 expense_hash,
                          uint8_t status,
                          eosio::asset total_actual,
                          std::vector<char> data) {
  require_auth(_expense);

  edu_expenses_index expenses(_edubridge, coopname.value);
  auto byhash = expenses.get_index<"byhash"_n>();
  auto it = byhash.find(expense_hash);
  eosio::check(it != byhash.end(),
               "Расход программы не найден по идентификатору служебной записки");

  eosio::check(total_actual.symbol == it->amount.symbol,
               "Некорректный символ валюты в сумме фактического расхода");
  eosio::check(total_actual.amount >= 0 && total_actual.amount <= it->amount.amount,
               "Фактический расход превышает выделенные программой средства");

  const eosio::asset unspent = it->amount - total_actual;
  if (unspent.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::EXPENSE_UNFUND,
                   processes::edubridge::SPEND,
                   unspent, coopname, expense_hash,
                   "Возврат неизрасходованных средств в фонд ЦПП «Образование»");
  }

  byhash.erase(it);
}
