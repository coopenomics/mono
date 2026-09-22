/**
 * @brief Удержание взноса до конца гарантийного срока курса.
 *
 * Гарантийный срок идёт от даты начала занятий курса. Пока он не истёк,
 * участник вправе закрыть подписку и получить возврат, поэтому взнос,
 * списанный в фонд (`chargefee`), той же транзакцией уходит на удержание и на
 * расходы программы не идёт. Срок отслеживает кооператив: он разблокирует
 * взнос, когда срок курса вышел (`unlockfee`); отмена и закрытие подписки
 * возвращают удержанное в фонд сами.
 *
 * Одна ledger2-операция:
 *  - `o.edu.lock` (TRANSFER w.edu.fund → w.edu.escrow, без проводки — оба на
 *    счёте 86).
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - подписка с указанным hash существует;
 *  - удерживается не больше собранного по подписке.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::lockfee(eosio::name coopname,
                        checksum256 sub_hash,
                        eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма удержания взноса");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(!sub->is_tracked() || sub->locked_or_zero() + amount <= sub->charged_or_zero(),
               "Удерживается не больше собранного по подписке");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::LOCK_FEE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_lock_fee_memo());

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    s.set_amounts(s.charged_or_zero(), s.reserved_or_zero(), s.locked_or_zero() + amount);
  });
}
