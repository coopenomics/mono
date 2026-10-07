/**
 * @brief Отмена выдачи займа до выплаты.
 *
 * Обеспечение возвращается в программу, начисление к выдаче снимается, запись
 * удаляется. Платёж, уже переданный кассиру, отменяется через кассира.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::cancelloan(eosio::name coopname, checksum256 debt_hash, std::string reason) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.source == _debt, "Заём другого приложения отменяется в нём");
  eosio::check(d.status == Debt::Status::CREATED || d.status == Debt::Status::AUTHORIZED || d.status == Debt::Status::SIGNED,
               "Отменить можно только заём до выплаты; платёж у кассира отменяет кассир");

  Debt::Core::abandon_before_issue(coopname, d);

  require_recipient(d.username);
  require_recipient(coopname);
}
