/**
 * @brief Разблокировка взноса по истечении гарантийного срока курса.
 *
 * Срок вышел — возврата по гарантии уже не будет, и удержанный взнос
 * становится свободными средствами программы: из них кооператив оплачивает
 * расходы и выделяет резерв выплат преподавателям.
 *
 * Одна ledger2-операция:
 *  - `o.edu.unlock` (TRANSFER w.edu.escrow → w.edu.fund, без проводки — оба на
 *    счёте 86).
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - подписка с указанным hash существует;
 *  - разблокируется не больше удержанного по этой подписке.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::unlockfee(eosio::name coopname,
                          checksum256 sub_hash,
                          eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма разблокировки взноса");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(amount <= sub->locked_or_zero(),
               "Разблокируется не больше удержанного по подписке");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::UNLOCK_FEE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_unlock_fee_memo());

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    s.set_amounts(s.charged_or_zero(), s.reserved_or_zero(), s.locked_or_zero() - amount);
  });
}
