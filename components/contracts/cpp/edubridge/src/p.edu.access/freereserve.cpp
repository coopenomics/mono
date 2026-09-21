/**
 * @brief Высвобождение резерва выплат преподавателям при отмене подписки.
 *
 * Подписка отменяется — оплаченные ею занятия не состоятся, и резерв под них
 * преподавателям не понадобится. Он возвращается в фонд программы той же
 * транзакцией, что и отмена: из фонда идёт возврат ученику.
 *
 * Одна ledger2-операция:
 *  - `o.edu.free` (TRANSFER w.edu.teach → w.edu.fund, без проводки — оба на
 *    счёте 86).
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - подписка с указанным hash существует;
 *  - высвобождается не больше зарезервированного по этой подписке.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::freereserve(eosio::name coopname,
                            checksum256 sub_hash,
                            eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма высвобождаемого резерва");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(!sub->is_tracked() || amount <= sub->reserved_or_zero(),
               "Высвобождается не больше зарезервированного по подписке");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::FREE_TEACHER_RESERVE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_free_reserve_memo());

  subs.modify(sub, _edubridge, [&](auto& s) {
    if (s.is_tracked()) {
      s.reserved.emplace(s.reserved_or_zero() - amount);
    }
  });
}
