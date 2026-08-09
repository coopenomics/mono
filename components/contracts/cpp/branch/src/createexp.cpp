/**
 * @brief Подать расход кооперативного участка в шасси расходов
 * (requirement b6 «Экономика КУ»; процесс p.brn.spend).
 *
 * Участок — только инициатор. Сумма служебной записки уходит из общего
 * кошелька членских взносов КУ в пул расходов участка (o.brn.expfnd) и
 * перестаёт быть доступной распределению между участниками, после чего
 * записка передаётся шасси расходов: решение совета, оплата по реквизитам
 * либо выдача аванса под отчёт, отчёт с чеками, закрытие. На терминальном
 * переходе шасси вызывает `branch::onexpdone`, где неизрасходованный остаток
 * возвращается участку.
 *
 * Транзит через пул нужен и по существу (видно, сколько средств участка
 * отдано под расходы), и технически: шасси работает с кооперативным пулом, а
 * общий кошелёк участка ведёт разрез по участку — прямой перевод между ними
 * невозможен, операция несёт один username.
 *
 * Механика оплаты задаётся по каждой позиции (аванс под отчёт пайщику либо
 * прямая оплата организации) и проверяется шасси.
 *
 * Guards:
 *  - записка подписана создателем; хотя бы одна позиция; сумма > 0;
 *  - КУ существует, создатель — председатель этого участка;
 *  - расход с таким идентификатором ещё не подавался;
 *  - достаточность средств проверяет сам перевод в книге учёта.
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::createexp(eosio::name coopname, eosio::name braname,
                                          eosio::name creator,
                                          eosio::checksum256 expense_hash,
                                          std::vector<ExpenseDomain::item> items,
                                          document2 statement) {
  check_auth_or_fail(_branch, coopname, coopname, "createexp"_n);

  verify_document_or_fail(statement, {creator});
  eosio::check(!items.empty(), "Расход должен содержать хотя бы одну позицию");

  auto branch = get_branch_or_fail(coopname, braname);
  // Отправить расход на решение совета — полномочие председателя участка:
  // с этого момента средства участка выделяются под расход. Планировать
  // расходы в реестре может любой оператор участка, но подаёт председатель.
  eosio::check(branch.trustee == creator,
               "Расход участка подаёт только председатель этого кооперативного участка");

  eosio::asset amount = items.front().planned_amount;
  amount.amount = 0;
  for (const auto& item : items) {
    eosio::check(item.planned_amount.is_valid() && item.planned_amount.amount > 0,
                 "Сумма каждой позиции расхода должна быть больше нуля");
    eosio::check(item.planned_amount.symbol == _root_govern_symbol,
                 "Некорректный символ валюты в сумме позиции расхода");
    amount += item.planned_amount;
  }
  eosio::check(amount.amount > 0, "Сумма расхода должна быть больше нуля");

  branch_expenses_index expenses(_branch, coopname.value);
  auto byhash = expenses.get_index<"byhash"_n>();
  eosio::check(byhash.find(expense_hash) == byhash.end(),
               "Расход с таким идентификатором уже подан");

  expenses.emplace(coopname, [&](auto& e) {
    e.id      = expenses.available_primary_key();
    e.hash    = expense_hash;
    e.braname = braname;
    e.creator = creator;
    e.amount  = amount;
  });

  // Средства участка выделяются под расход до передачи записки в шасси:
  // если перевод не прошёл, записка не создаётся.
  Ledger2::apply(_branch, coopname,
                 operations::branch::EXPENSE_FUND,
                 amount, braname, expense_hash,
                 "Выделение средств кооперативного участка под расход");

  // Callback завершения: по нему участок получает обратно неизрасходованное.
  // data пустой — запись резолвится по идентификатору расхода.
  ExpenseDomain::callback_handler callback{
    .contract = _branch,
    .action   = Names::Branch::ON_BRANCH_EXPENSE_DONE,
    .data     = std::vector<char>{}
  };

  // Authority — _branch: у branch@eosio.code нет coopname@active, а шасси
  // принимает контракты-инициаторы по общему белому списку.
  eosio::action(
    eosio::permission_level{_branch, "active"_n},
    _expense,
    Names::External::CREATE_EXPENSE_PROPOSAL,
    std::make_tuple(coopname, creator, expense_hash,
                    ledger2_wallets::BRANCH_EXPENSE_POOL, items, callback, statement)
  ).send();
}
