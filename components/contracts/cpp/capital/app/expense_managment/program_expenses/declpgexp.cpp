/**
 * @brief Отклоняет программный расход на любом этапе до подтверждения оплаты.
 *
 * Допустимо из created (отказ председателя), approved (отказ совета через callback)
 * и authorized (отказ gateway по реквизитам). Возвращает зарезервированную сумму
 * обратно в program_expense_pool и удаляет запись.
 *
 * @param coopname     Кооператив
 * @param expense_hash Хеш расхода
 * @param reason       Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p coopname (если отказ инициирован председателем),
 *       @p _soviet (если совет отказал) или @p _gateway (если выпуск платежа провалился).
 */
void capital::declpgexp(name coopname, checksum256 expense_hash, std::string reason) {
  eosio::check(
    eosio::has_auth(coopname) || eosio::has_auth(_soviet) || eosio::has_auth(_gateway),
    "Отклонить программный расход может только председатель, совет или gateway"
  );

  auto expense = Capital::Expenses::get_program_expense_or_fail(coopname, expense_hash);
  eosio::check(
    expense.status == Capital::Expenses::Status::CREATED ||
    expense.status == Capital::Expenses::Status::APPROVED ||
    expense.status == Capital::Expenses::Status::AUTHORIZED,
    "Программный расход уже завершён (paid/declined)"
  );

  Capital::State::release_program_expense(coopname, expense.amount);
  Capital::Expenses::delete_program_expense(coopname, expense.id);
}
