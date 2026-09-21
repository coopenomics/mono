/**
 * @brief Коллбэк шасси расходов — расход программы завершён (p.edu.spend).
 *
 * Приходит inline-вызовом из шасси на терминальном переходе служебной
 * записки: совет отклонил расход либо расход закрыт после отчёта.
 *  - отклонение — выделенное возвращается в фонд целиком (оплат до отклонения
 *    быть не может);
 *  - закрытие в пределах выделенного — в фонд возвращается разница
 *    (o.edu.expunf);
 *  - закрытие с перерасходом — шасси доплатило получателю аванса из пула
 *    расходов сверх выделенного под этот расход, то есть заняло у соседних
 *    расходов. Превышение докрывается из фонда программы в пул (o.edu.expfnd).
 *    Фонд держит только свободные средства программы, поэтому докрыть можно
 *    не больше, чем в нём есть: при нехватке закрытие ждёт пополнения фонда.
 *
 * Расход завершён — запись программы стирается из RAM, история движений
 * остаётся в журнале действий.
 *
 * Guards:
 *  - require_auth(_expense) — вызывает только шасси расходов;
 *  - расход найден по идентификатору записки;
 *  - статус — «закрыт» либо «отклонён»; при отклонении потраченного нет.
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
  eosio::check(total_actual.amount >= 0,
               "Фактический расход не может быть отрицательным");

  const bool closed   = status == static_cast<uint8_t>(ExpenseDomain::ProposalStatus::CLOSED);
  const bool declined = status == static_cast<uint8_t>(ExpenseDomain::ProposalStatus::DECLINED);
  eosio::check(closed || declined,
               "Завершение расхода программы принимается только закрытым либо отклонённым");
  eosio::check(!declined || total_actual.amount == 0,
               "Отклонённый расход не может иметь фактических оплат");

  if (total_actual <= it->amount) {
    const eosio::asset unspent = it->amount - total_actual;
    if (unspent.amount > 0) {
      Ledger2::apply(_edubridge, coopname,
                     operations::edubridge::EXPENSE_UNFUND,
                     processes::edubridge::SPEND,
                     unspent, coopname, expense_hash,
                     "Возврат неизрасходованных средств в фонд ЦПП «Образование»");
    }
  } else {
    // Перерасход: доплата ушла из пула сверх выделенного под этот расход.
    // Пул восполняется из фонда программы; нехватку фонда покажет сам перевод.
    const eosio::asset excess = total_actual - it->amount;
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::EXPENSE_FUND,
                   processes::edubridge::SPEND,
                   excess, coopname, expense_hash,
                   "Покрытие перерасхода по расходу ЦПП «Образование» из фонда программы");
  }

  byhash.erase(it);
}
