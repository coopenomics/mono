/**
 * @brief Закрытие подписки по истечении оплаченного срока.
 *
 * Запись стирается из RAM: в таблице живут только активные подписки
 * (chain-RAM — рабочее состояние, история доступа — у парсера). Момент
 * закрытия определяет кооператив: истечение оплаченного срока либо досрочно,
 * по его решению.
 *
 * Возврата участнику нет. Остаток по подписке расходится контрактом:
 * удержанное и резерв за непроведённые занятия возвращаются на кошелёк
 * программы, взнос преподавателей за проведённые занятия остаётся в резерве
 * курса.
 *
 * Подписка, открытая до учёта занятий, закрывается по прежнему правилу:
 * удержанное возвращается на кошелёк программы, запись стирается.
 *
 * Guards:
 *  - по подписке завершён расчёт за открытое занятие курса.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::expiresub(eosio::name coopname,
                          checksum256 sub_hash) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);

  if (!sub->has_plan()) {
    const eosio::asset locked = sub->locked_or_zero();
    if (locked.amount > 0) {
      Ledger2::apply(_edubridge, coopname,
                     operations::edubridge::UNLOCK_FEE,
                     processes::edubridge::ACCESS,
                     locked, coopname, sub_hash,
                     Edubridge::Memo::get_unlock_fee_memo());
    }
    subs.erase(sub);
    return;
  }

  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);
  Edubridge::check_no_pending_lesson(coopname, terms, *sub);

  Edubridge::settle_closing(coopname, *sub, eosio::asset(0, _root_govern_symbol), false);
  subs.erase(sub);
}
