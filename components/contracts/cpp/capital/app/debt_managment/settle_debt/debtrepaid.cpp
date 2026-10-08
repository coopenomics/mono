/**
 * @brief Погашение займа Генерации деньгами — обратный вызов реестра займов
 * Контракт займов сообщает, что пайщик вернул заём Генерации с главного
 * кошелька: долг уменьшается в доле пайщика, у пайщика и в проекте, средства
 * проекта, занятые под заём, высвобождаются. Проводки возврата делает контракт
 * займов.
 *
 * Заготовка: погашение займов Генерации деньгами владельцем отложено (Р37),
 * контракт займов это действие пока не вызывает.
 * @param coopname Наименование кооператива
 * @param username Пайщик-заёмщик
 * @param debt_hash Хэш займа
 * @param amount Сумма погашения
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p _debt
 */
void capital::debtrepaid(name coopname, name username, checksum256 debt_hash, asset amount) {
  require_auth(_debt);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  eosio::check(exist_debt.username == username, "Заём принадлежит другому пайщику");
  eosio::check(exist_debt.status == Capital::Debts::Status::PAID, "Погашается только выданный заём");
  Wallet::validate_asset(amount);
  eosio::check(amount <= exist_debt.amount, "Сумма погашения больше остатка займа");

  auto contributor = Capital::Contributors::get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Договор УХД с пайщиком не найден");
  auto project = Capital::Projects::get_project_or_fail(coopname, exist_debt.project_hash);
  auto segment = Capital::Segments::get_segment_or_fail(coopname, exist_debt.project_hash, username, "Сегмент не найден");

  Capital::Segments::decrease_debt_amount(coopname, segment.id, amount);
  Capital::Contributors::decrease_debt_amount(coopname, contributor->id, amount);
  Capital::Projects::subtract_used_for_compensation(coopname, project.id, amount);
  Capital::Projects::sync_total_debt(coopname, project.id);

  if (amount == exist_debt.amount) {
    Capital::Debts::delete_debt(coopname, exist_debt.id);
  } else {
    Capital::Debts::decrease_debt_amount(coopname, exist_debt.id, amount);
  }
}
