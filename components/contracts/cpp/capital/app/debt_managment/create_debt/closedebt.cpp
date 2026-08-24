/**
 * @brief Закрывает невозвращённый заём: работа-обеспечение переходит кооперативу.
 *
 * Применяется к просроченному займу: срок возврата прошёл, пайщик не вернул
 * заём деньгами и не сдал результат. Работа, накопленная пайщиком на этом
 * компоненте и служившая обеспечением займа, становится нематериальным активом
 * кооператива, а обязательство пайщика списывается. Санкций к пайщику нет,
 * подпись пайщика не требуется.
 *
 * В учёте это две операции: работа переходит кооперативу (Дт 04 / Кт 08)
 * и заём списывается (Дт 80 / Кт 58). От обычного возврата отличается тем,
 * что паевой взнос пайщику не начисляется — заём закрыт имуществом.
 *
 * @param coopname   Наименование кооператива
 * @param debt_hash  Хеш закрываемого займа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 */
void capital::closedebt(name coopname, checksum256 debt_hash) {
  require_auth(coopname);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  // Только просроченный заём: пока срок не вышел, у пайщика есть время вернуть
  // деньги или сдать результат, и обращать взыскание на работу рано.
  eosio::check(exist_debt.status == Capital::Debts::Status::OVERDUE,
               "Закрыть переходом работы кооперативу можно только просроченный заём");

  auto project = Capital::Projects::get_project_or_fail(coopname, exist_debt.project_hash);

  auto exist_segment = Capital::Segments::get_segment_or_fail(coopname,
    exist_debt.project_hash, exist_debt.username, "Сегмент пайщика не найден");

  auto contributor = Capital::Contributors::get_contributor(coopname, exist_debt.username);
  eosio::check(contributor.has_value(), "Контрибьютор не найден");

  auto memo = Capital::Memo::get_debt_writeoff_memo(exist_debt.username, debt_hash);

  // Работа-обеспечение переходит кооперативу как нематериальный актив.
  Ledger2::apply(_capital, coopname, operations::capital::CREATE_NMA, processes::capital::DEBT,
                 exist_debt.amount, exist_debt.username, debt_hash, memo);

  // Заём списывается: обязательство пайщика закрыто имуществом.
  Ledger2::apply(_capital, coopname, operations::capital::DEBT_WRITEOFF, processes::capital::DEBT,
                 exist_debt.amount, exist_debt.username, debt_hash, memo);

  Capital::Segments::decrease_debt_amount(coopname, exist_segment.id, exist_debt.amount);
  Capital::Segments::decrease_active_debts_count(coopname, exist_debt.project_hash, exist_debt.username);

  // Зеркало выдачи займа: сумма перестаёт числиться использованной на компенсацию.
  Capital::Projects::subtract_used_for_compensation(coopname, project.id, exist_debt.amount);

  Capital::Contributors::decrease_debt_amount(coopname, contributor->id, exist_debt.amount);

  Capital::Debts::mark_writeoff(coopname, exist_debt.id, memo, _capital);

  // Сводный учёт займов: запись закрывается и там.
  Loan::settle_debt(_capital, coopname, exist_debt.username, debt_hash, exist_debt.amount);

  // Пайщик и кооператив получают уведомление о закрытии займа.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
}
