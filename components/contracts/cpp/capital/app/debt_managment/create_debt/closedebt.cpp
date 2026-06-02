/**
 * @brief Закрывает долг созданием НМА кооператива из коммитов-обеспечения.
 *
 * Срабатывает, когда родительский компонент проекта явно перешёл в `cancelled`:
 * проект до акта-2 не дойдёт, возврат через `signact2` невозможен.
 * Коммиты-обеспечение, накопленные пайщиком на сегменте проекта-компонента
 * (`w.cap.gen`), формируют НМА кооператива на отдельном кошельке `w.cap.nma`,
 * а обязательство пайщика по займу списывается (write-off). Никаких санкций
 * к пайщику не применяется, совет не собирается, подпись пайщика не требуется.
 *
 * Двухоперационная свёртка ledger2:
 *  - o.cap.crtnma — TRANSFER w.cap.gen → w.cap.nma, Дт 04 / Кт 08.
 *                   Зеркалит o.cap.accept, но без участия пайщика: НМА из
 *                   коммитов-обеспечения долга идут в имущество кооператива,
 *                   а не на share программы пайщика.
 *  - o.cap.dbtwrf — BURN w.cap.loan, Дт 80 / Кт 58.
 *                   Списание долга (write-off). Зеркало o.cap.repay, но share
 *                   пайщика не пополняется — долг закрыт имущественно.
 *
 * Решение 2026-05-19 (Игорь Смуров / Алексей Муравьёв): срок займа фиксированный
 * (1 год от выплаты), но при явной отмене компонента закрытие происходит
 * досрочно — без ожидания due_at.
 *
 * @param coopname   Наименование кооператива (scope)
 * @param debt_hash  Хеш закрываемого займа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация только от @p coopname. Action идёт из backend кооператива,
 *       отслеживающего переход компонента в `cancelled`.
 */
void capital::closedebt(name coopname, checksum256 debt_hash) {
  require_auth(coopname);

  // 1. Получить долг
  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  // 2. Долг должен быть активным (выплачен, не погашен)
  eosio::check(exist_debt.status == Capital::Debts::Status::PAID
            || exist_debt.status == Capital::Debts::Status::OVERDUE,
               "Закрытие долга допустимо для активного (paid) или просроченного (overdue) займа");

  // 3. Guard на статус родительского компонента: только `cancelled` (отменён).
  // Если компонент завершён нормально (`finalized`/`result`) — возврат идёт
  // через signact2 → o.cap.repay, не сюда.
  auto project = Capital::Projects::get_project_or_fail(coopname, exist_debt.project_hash);
  eosio::check(project.status == Capital::Projects::Status::CANCELLED,
               "Закрытие долга через НМА допустимо только при cancelled статусе компонента проекта");

  // 4. Сегмент пайщика на компоненте
  auto exist_segment = Capital::Segments::get_segment_or_fail(coopname,
    exist_debt.project_hash, exist_debt.username, "Сегмент пайщика не найден");

  // 5. Контрибьютор для обновления глобального долга
  auto contributor = Capital::Contributors::get_contributor(coopname, exist_debt.username);
  eosio::check(contributor.has_value(), "Контрибьютор не найден");

  auto memo = Capital::Memo::get_debt_memo(exist_debt.username);

  // 6. o.cap.crtnma: TRANSFER GENERATOR_FUND → NMA, Дт 04 / Кт 08.
  // Из коммитов-обеспечения долга создаётся НМА кооператива.
  Ledger2::apply(_capital, coopname, operations::capital::CREATE_NMA,
                 exist_debt.amount, exist_debt.username, debt_hash, memo);

  // 7. o.cap.dbtwrf: BURN LOAN_ISSUED, Дт 80 / Кт 58.
  // Финансовое вложение кооператива в пайщика списано (write-off); share пайщика
  // не пополняется — долг закрыт имущественно.
  Ledger2::apply(_capital, coopname, operations::capital::DEBT_WRITEOFF,
                 exist_debt.amount, exist_debt.username, debt_hash, memo);

  // 8. Обновить агрегаты сегмента: -debt_amount, -active_debts_count.
  Capital::Segments::decrease_debt_amount(coopname, exist_segment.id, exist_debt.amount);
  Capital::Segments::decrease_active_debts_count(coopname, exist_debt.project_hash, exist_debt.username);

  // 9. Уменьшить used_for_compensation в проекте (зеркало createdebt).
  Capital::Projects::subtract_used_for_compensation(coopname, project.id, exist_debt.amount);

  // 10. Глобальный долг контрибьютора уменьшаем (как в settledebt).
  Capital::Contributors::decrease_debt_amount(coopname, contributor->id, exist_debt.amount);

  // 11. Запись долга → WRITEOFF (для аудита).
  Capital::Debts::mark_writeoff(coopname, exist_debt.id);

  // 12. Централизованный реестр в loan-контракте: уменьшаем сводную, удаляем запись.
  Loan::settle_debt(_capital, coopname, exist_debt.username, debt_hash, exist_debt.amount);

  // 13. Уведомить пайщика и кооператив.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
}
