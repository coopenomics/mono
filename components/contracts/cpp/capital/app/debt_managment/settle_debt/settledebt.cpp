/**
 * @brief Погашает активный заём пайщика деньгами.
 *
 * Прямой канал погашения (без сдачи результата): пайщик-должник либо председатель
 * вносит сумму, ровно равную остатку долга, и заём закрывается. В ledger2 фиксируется
 * операция REPAY (Dr 80 / Cr 58), глобальный долг пайщика в contributors.debt_amount
 * уменьшается, запись долга переходит в SETTLED.
 *
 * Альтернативный путь закрытия — через подписание акта-2 по результату (см. signact2.cpp),
 * там та же операция REPAY вызывается на сумму result->debt_amount.
 *
 * @param coopname   Наименование кооператива
 * @param debt_hash  Хеш погашаемого долга
 * @param amount     Сумма погашения (должна совпасть с debt.amount — полное закрытие)
 * @param statement  Документ-заявление на погашение (SettleDebtStatement)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется либо от должника, либо от @p coopname (председатель).
 */
void capital::settledebt(name coopname, checksum256 debt_hash, eosio::asset amount, document2 statement) {
  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  eosio::check(eosio::has_auth(exist_debt.username) || eosio::has_auth(coopname),
               "Погасить заём может либо сам должник, либо председатель кооператива");

  eosio::check(exist_debt.status == Capital::Debts::Status::PAID,
               "Погашение деньгами доступно только для активного займа (статус paid)");

  eosio::check(amount.is_valid(), "Сумма погашения некорректна");
  eosio::check(amount.symbol == exist_debt.amount.symbol,
               "Символ суммы погашения не совпадает с символом долга");
  eosio::check(amount == exist_debt.amount,
               "Сумма погашения должна полностью покрывать остаток долга");

  auto contributor = Capital::Contributors::get_contributor(coopname, exist_debt.username);
  eosio::check(contributor.has_value(), "Контрибьютор не найден");

  // Возврат займа пайщиком: Dr 80 / Cr 58 — закрываем финансовое вложение в участника.
  auto memo = Capital::Memo::get_settle_debt_memo(exist_debt.username, debt_hash);
  Ledger2::apply(_capital, coopname, operations::capital::REPAY, amount,
                 exist_debt.username, debt_hash, memo);

  Capital::Contributors::decrease_debt_amount(coopname, contributor->id, amount);
  Capital::Debts::mark_settled(coopname, exist_debt.id, memo, _capital);
}
