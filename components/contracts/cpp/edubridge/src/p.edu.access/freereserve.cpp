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
 *  - пока подписка жива, высвобождается не больше зарезервированного по ней.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::freereserve(eosio::name coopname,
                            checksum256 sub_hash,
                            eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма высвобождаемого резерва");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  auto found = by_hash.find(sub_hash);
  const bool tracked = found != by_hash.end() && found->is_tracked();
  eosio::check(!tracked || amount <= found->reserved_or_zero(),
               "Высвобождается не больше зарезервированного по подписке");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::FREE_TEACHER_RESERVE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_free_reserve_memo());

  if (tracked) {
    subs.modify(subs.find(found->id), _edubridge, [&](auto& s) {
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() - amount, s.locked_or_zero());
    });
  }
}
