/**
 * @brief Выделение доли собранного взноса в резерв выплат преподавателям.
 *
 * Взнос ученика складывается из себестоимости — часов занятий по ставке
 * преподавателя — и наценки кооператива. Себестоимость обещана преподавателям
 * за оплаченные занятия, поэтому сразу после списания взноса в фонд
 * (`chargefee`) она уходит в резерв. В фонде остаются свободные средства
 * программы: только из них идут расходы и докрывается перерасход.
 *
 * Одна ledger2-операция:
 *  - `o.edu.allot` (TRANSFER w.edu.fund → w.edu.teach, без проводки — оба на
 *    счёте 86).
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - подписка с указанным hash существует;
 *  - в резерв уходит не больше собранного по подписке.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::allotfee(eosio::name coopname,
                         checksum256 sub_hash,
                         eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма резерва выплат преподавателям");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->reserved + amount <= sub->charged,
               "В резерв выплат преподавателям уходит не больше собранного по подписке");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::ALLOT_TEACHER_RESERVE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_allot_reserve_memo());

  subs.modify(sub, _edubridge, [&](auto& s) {
    s.reserved += amount;
  });
}
