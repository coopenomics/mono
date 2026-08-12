/**
 * @brief Callback шасси расходов — расход участка завершён
 * (requirement b6 «Экономика КУ»; процесс p.brn.spend).
 *
 * Приходит inline-вызовом из шасси на терминальном переходе служебной
 * записки: совет отклонил расход либо расход закрыт после отчёта. Всё, что
 * из выделенных средств не было потрачено, возвращается в общий кошелёк
 * участка (o.brn.expunf) и снова становится доступным распределению:
 *  - отклонение — возвращается вся сумма (оплат до отклонения быть не может);
 *  - закрытие — возвращается разница между выделенным и фактически
 *    потраченным (в том числе после возврата пайщиком остатка аванса).
 *
 * Расход завершён — запись участка стирается из RAM, история движений
 * остаётся в журнале действий.
 *
 * Guards:
 *  - require_auth(_expense) — вызывает только шасси расходов;
 *  - расход найден по идентификатору записки;
 *  - потрачено не больше, чем было выделено.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::onexpdone(eosio::name coopname,
                                          eosio::checksum256 expense_hash,
                                          uint8_t status,
                                          eosio::asset total_actual,
                                          std::vector<char> data) {
  require_auth(_expense);

  branch_expenses_index expenses(_branch, coopname.value);
  auto byhash = expenses.get_index<"byhash"_n>();
  auto it = byhash.find(expense_hash);
  eosio::check(it != byhash.end(),
               "Расход кооперативного участка не найден по идентификатору служебной записки");

  eosio::check(total_actual.symbol == it->amount.symbol,
               "Некорректный символ валюты в сумме фактического расхода");
  eosio::check(total_actual.amount >= 0 && total_actual.amount <= it->amount.amount,
               "Фактический расход превышает выделенные участком средства");

  const eosio::asset unspent = it->amount - total_actual;
  if (unspent.amount > 0) {
    Ledger2::apply(_branch, coopname,
                   operations::branch::EXPENSE_UNFUND,
                   processes::branch::SPEND,
                   unspent, it->braname, expense_hash,
                   "Возврат неизрасходованных средств в общий кошелёк кооперативного участка");
  }

  byhash.erase(it);
}
