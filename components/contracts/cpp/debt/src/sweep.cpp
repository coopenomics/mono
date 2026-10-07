/**
 * @brief Сверка сроков займов.
 *
 * Выданный заём с прошедшим сроком переходит в просрочку — пайщик получает
 * уведомление. Заём, который пробыл в просрочке пять дней, закрывается
 * обращением обеспечения в пользу кооператива (Дт 80 / Кт 58). Займы других
 * приложений только помечаются: обеспечение по ним обращает приложение.
 *
 * За вызов обрабатывается не больше 25 займов; цепь не сообщает, сколько
 * осталось — контроллер считает это по зеркалу и зовёт сверку повторно.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::sweep(eosio::name coopname, uint32_t limit) {
  require_auth(coopname);

  const uint32_t budget = limit == 0 || limit > Debt::Core::SWEEP_MAX ? Debt::Core::SWEEP_MAX : limit;
  const auto now = Debt::Core::now();
  const uint32_t now_sec = now.sec_since_epoch();

  // Сначала собираем кандидатов по индексу срока, потом меняем записи:
  // удаление строки во время обхода индекса сломало бы итератор.
  std::vector<uint64_t> to_overdue;
  std::vector<uint64_t> to_seize;
  {
    Debt::debts_index debts(_debt, coopname.value);
    auto by_due = debts.get_index<"bydue"_n>();
    uint32_t taken = 0;
    for (auto it = by_due.begin(); it != by_due.end() && taken < budget; ++it) {
      if (it->due_at.sec_since_epoch() > now_sec) break;
      if (it->status == Debt::Status::ISSUED) {
        to_overdue.push_back(it->id);
        ++taken;
      } else if (it->status == Debt::Status::OVERDUE && it->source == _debt &&
                 it->overdue_at.sec_since_epoch() + Debt::Core::GRACE_SECONDS <= now_sec) {
        to_seize.push_back(it->id);
        ++taken;
      }
    }
  }

  Debt::debts_index debts(_debt, coopname.value);

  for (uint64_t id : to_overdue) {
    auto it = debts.find(id);
    debts.modify(it, RamPayer::of(debts, coopname), [&](auto& row) {
      row.status = Debt::Status::OVERDUE;
      row.overdue_at = now;
    });
    require_recipient(it->username);
  }

  for (uint64_t id : to_seize) {
    auto it = debts.find(id);
    const Debt::debt d = *it;
    const auto& c = Debt::get_collateral_or_fail(d.collateral);

    eosio::asset seized = d.pledged < d.remaining ? d.pledged : d.remaining;
    Debt::Core::seize(c, coopname, d.username, seized, d.debt_hash);
    // Обеспечение сверх остатка (не возникает при обеспечении один к одному) возвращается пайщику.
    Debt::Core::unpledge(c, coopname, d.username, d.pledged - seized, d.debt_hash);
    Ledger2::apply(_debt, coopname, operations::debt::CLOSE, processes::debt::LOAN, d.remaining, d.username,
                   d.debt_hash, Debt::Memo::get_close_memo(d.debt_hash));
    Debt::Core::change_summary(coopname, d.username, -d.remaining);
    debts.erase(it);
    require_recipient(d.username);
  }

  require_recipient(coopname);
}
