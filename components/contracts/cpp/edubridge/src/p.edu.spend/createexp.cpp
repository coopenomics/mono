/**
 * @brief Подать расход ЦПП «Образование» в шасси расходов (процесс p.edu.spend).
 *
 * Программа — только инициатор. Сумма служебной записки уходит из фонда
 * программы в пул расходов (o.edu.expfnd) и перестаёт быть свободной, после
 * чего записка передаётся шасси расходов: решение совета, оплата по
 * реквизитам либо выдача аванса под отчёт, отчёт с чеками, закрытие. На
 * терминальном переходе шасси вызывает `edubridge::onexpdone`, где
 * неизрасходованный остаток возвращается в фонд.
 *
 * Транзит через пул нужен и по существу (видно, сколько средств программы
 * отдано под расходы), и технически: шасси работает с кооперативным пулом.
 *
 * Механика оплаты задаётся по каждой позиции (аванс под отчёт пайщику либо
 * прямая оплата организации) и проверяется шасси.
 *
 * Guards:
 *  - записка подписана тем, от чьего имени подана; хотя бы одна позиция;
 *  - сумма каждой позиции > 0 в символе кооператива;
 *  - расход с таким идентификатором ещё не подавался;
 *  - достаточность средств фонда проверяет сам перевод в книге учёта.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::createexp(eosio::name coopname,
                          eosio::name creator,
                          eosio::checksum256 expense_hash,
                          std::vector<ExpenseDomain::item> items,
                          document2 statement) {
  require_auth(coopname);

  verify_document_or_fail(statement, { creator });
  verify_signer_keys_or_fail(statement, creator);
  eosio::check(!items.empty(), "Расход должен содержать хотя бы одну позицию");

  eosio::asset amount = items.front().planned_amount;
  amount.amount = 0;
  for (const auto& item : items) {
    Edubridge::check_money(item.planned_amount, "Сумма позиции расхода");
    amount += item.planned_amount;
  }

  edu_expenses_index expenses(_edubridge, coopname.value);
  auto byhash = expenses.get_index<"byhash"_n>();
  eosio::check(byhash.find(expense_hash) == byhash.end(),
               "Расход с таким идентификатором уже подан");

  expenses.emplace(_edubridge, [&](auto& e) {
    e.id      = expenses.available_primary_key();
    e.hash    = expense_hash;
    e.creator = creator;
    e.amount  = amount;
  });

  // Средства выделяются под расход до передачи записки в шасси: если перевод
  // не прошёл, записка не создаётся.
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::EXPENSE_FUND,
                 processes::edubridge::SPEND,
                 amount, coopname, expense_hash,
                 "Выделение средств ЦПП «Образование» под расход");

  // Коллбэк завершения: по нему программа получает обратно неизрасходованное.
  ExpenseDomain::callback_handler callback{
    .contract = _edubridge,
    .action   = Names::Edubridge::ON_EDU_EXPENSE_DONE,
    .data     = std::vector<char>{}
  };

  eosio::action(
    eosio::permission_level{_edubridge, "active"_n},
    _expense,
    Names::External::CREATE_EXPENSE_PROPOSAL,
    std::make_tuple(coopname, creator, expense_hash,
                    ledger2_wallets::EDU_EXPENSE_POOL, items, callback, statement)
  ).send();
}
