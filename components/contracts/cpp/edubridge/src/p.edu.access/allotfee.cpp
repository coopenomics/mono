/**
 * @brief Выделение доли взноса в резерв выплат преподавателям.
 *
 * Преподаватели получают за часы курса по плановой ставке, сколько бы учеников
 * на них ни пришло. Резерв добирается до этого обязательства за оплаченное
 * учениками время из взноса, освобождённого из удержания, — вместе с
 * разблокировкой (`unlockfee`), и не больше. В фонде остаются свободные
 * средства программы: только из них идут расходы.
 *
 * Одна ledger2-операция:
 *  - `o.edu.allot` (TRANSFER w.edu.fund → w.edu.teach, без проводки — оба на
 *    счёте 86).
 *
 * Выделенное прибавляется к резерву курса подписки (`educourses`): из него
 * оплачиваются результаты преподавателей этого курса. Курс берётся из записи
 * подписки; у закрытой подписки запись стёрта, и учёт курса не меняется.
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
                         uint64_t course_id,
                         eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма резерва выплат преподавателям");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  auto found = by_hash.find(sub_hash);
  const bool tracked = found != by_hash.end() && found->is_tracked();
  eosio::check(!tracked || found->reserved_or_zero() + amount <= found->charged_or_zero(),
               "В резерв выплат преподавателям уходит не больше собранного по подписке");
  eosio::check(found == by_hash.end() || found->course_id == course_id,
               "Курс резерва не совпадает с курсом подписки");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::ALLOT_TEACHER_RESERVE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_allot_reserve_memo());

  // Учёт курса: резерв курса растёт на выделенную сумму. Курс назван явно:
  // резерв выравнивается и после закрытия подписки, когда её запись стёрта.
  // В резерв и выплаты преподавателям курса направляется не больше собранного
  // по этому курсу — средства других курсов не затрагиваются.
  Edubridge::update_course(coopname, course_id, [&](auto& c) {
    eosio::check(c.reserve + c.settled + amount <= c.collected,
                 std::string{"В резерв выплат преподавателям направляется не больше собранного по курсу: собрано "} +
                   c.collected.to_string() + ", в резерве " + c.reserve.to_string() + ", выплачено " + c.settled.to_string());
    c.reserve += amount;
  });

  if (tracked) {
    subs.modify(subs.find(found->id), RamPayer::of(subs, coopname), [&](auto& s) {
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() + amount, s.locked_or_zero());
    });
  }
}
