/**
 * @brief Высвобождение излишка резерва выплат преподавателям.
 *
 * Подписка отменена либо закрыта, оплаченное время курса сократилось, и
 * обязательство перед преподавателями по курсу уменьшилось. Резерв сверх него
 * кооператив возвращает в фонд программы сразу после закрытия — свободными
 * средствами.
 *
 * Одна ledger2-операция:
 *  - `o.edu.free` (TRANSFER w.edu.teach → w.edu.fund, без проводки — оба на
 *    счёте 86).
 *
 * Высвобожденное вычитается из резерва курса подписки (`educourses`). Курс
 * берётся из записи подписки; у закрытой подписки запись стёрта, и учёт курса
 * не меняется.
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - пока подписка жива, высвобождается не больше зарезервированного по ней и
 *    не больше остатка резерва её курса.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::freereserve(eosio::name coopname,
                            checksum256 sub_hash,
                            uint64_t course_id,
                            eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма высвобождаемого резерва");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  auto found = by_hash.find(sub_hash);
  const bool tracked = found != by_hash.end() && found->is_tracked();
  eosio::check(!tracked || amount <= found->reserved_or_zero(),
               "Высвобождается не больше зарезервированного по подписке");
  eosio::check(found == by_hash.end() || found->course_id == course_id,
               "Курс резерва не совпадает с курсом подписки");

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::FREE_TEACHER_RESERVE,
                 processes::edubridge::ACCESS,
                 amount, coopname, sub_hash,
                 Edubridge::Memo::get_free_reserve_memo());

  // Учёт курса: резерв курса уменьшается на высвобожденную сумму. Курс назван
  // явно: резерв высвобождается и после закрытия подписки, когда её запись стёрта.
  Edubridge::update_course(coopname, course_id, [&](auto& c) {
    eosio::check(amount <= c.reserve,
                   std::string{"Высвобождается не больше остатка резерва выплат преподавателям по курсу: в резерве "} +
                     c.reserve.to_string());
    c.reserve -= amount;
  });

  if (tracked) {
    subs.modify(subs.find(found->id), RamPayer::of(subs, coopname), [&](auto& s) {
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() - amount, s.locked_or_zero());
    });
  }
}
