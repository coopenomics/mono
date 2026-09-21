/**
 * @brief Выделение доли взноса в резерв выплат преподавателям.
 *
 * Взнос ученика складывается из себестоимости — часов занятий по ставке
 * преподавателя — и наценки кооператива. Себестоимость обещана преподавателям
 * за оплаченные занятия и уходит в резерв, когда взнос стал свободным: сразу
 * после списания, если гарантийный срок курса уже истёк, либо вместе с
 * разблокировкой удержанного (`unlockfee`). В фонде остаются свободные средства
 * программы: только из них идут расходы.
 *
 * Одна ledger2-операция:
 *  - `o.edu.allot` (TRANSFER w.edu.fund → w.edu.teach, без проводки — оба на
 *    счёте 86).
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - пока подписка жива, в резерв уходит не больше собранного по ней. Закрытая
 *    подписка потолка не даёт: её запись стёрта, достаточность фонда проверит
 *    сам перевод.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::allotfee(eosio::name coopname,
                         checksum256 sub_hash,
                         eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма резерва выплат преподавателям");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  auto found = by_hash.find(sub_hash);
  const bool tracked = found != by_hash.end() && found->is_tracked();
  eosio::check(!tracked || found->reserved_or_zero() + amount <= found->charged_or_zero(),
               "В резерв выплат преподавателям уходит не больше собранного по подписке");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::ALLOT_TEACHER_RESERVE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_allot_reserve_memo());

  if (tracked) {
    subs.modify(subs.find(found->id), _edubridge, [&](auto& s) {
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() + amount, s.locked_or_zero());
    });
  }
}
