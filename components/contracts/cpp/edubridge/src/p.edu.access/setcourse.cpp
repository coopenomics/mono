/**
 * @brief Условия курса: по ним контракт считает все суммы процесса.
 *
 * Администратор задаёт плановую ставку часа, способ расчёта с преподавателем
 * (за каждого участника либо фиксированный за занятие), целевой членский
 * взнос за месяц, расписание, скидку за взнос разом, гарантийный срок и дату
 * начала занятий. Взнос участника, резерв преподавателям, взнос
 * преподавателя за занятие и возврат считаются отсюда.
 *
 * При действующих подписках денежные условия не меняются: участники вносили
 * взнос по ним. Дата начала занятий не меняется после первого занятия.
 *
 * Движений средств нет.
 *
 * Guards:
 *  - плановая ставка и целевой членский взнос в символе кооператива, ставка > 0;
 *  - занятий в месяц и минут в занятии > 0;
 *  - скидка за взнос разом не больше целевого членского взноса;
 *  - при действующих подписках денежные условия прежние.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::setcourse(eosio::name coopname,
                          uint64_t course_id,
                          eosio::asset planned_rate,
                          bool per_learner,
                          eosio::asset target_fee_month,
                          uint32_t lessons_per_month,
                          uint32_t lessons_total,
                          uint32_t lesson_minutes,
                          bool course_payment,
                          uint32_t discount_bp,
                          uint32_t guarantee_secs,
                          eosio::time_point_sec starts_at) {
  require_auth(coopname);

  Edubridge::check_money(planned_rate, "Плановая ставка");
  eosio::check(target_fee_month.is_valid() && target_fee_month.amount >= 0 &&
                 target_fee_month.symbol == _root_govern_symbol,
               "EDUBRIDGE_TARGET_FEE_INVALID: Некорректный целевой членский взнос");
  eosio::check(lessons_per_month > 0, "EDUBRIDGE_LESSONS_PER_MONTH_INVALID: Число занятий в месяц должно быть больше нуля");
  eosio::check(lesson_minutes > 0, "EDUBRIDGE_LESSON_MINUTES_INVALID: Длительность занятия должна быть больше нуля");
  eosio::check(discount_bp <= Edubridge::BP_IN_WHOLE, "EDUBRIDGE_DISCOUNT_INVALID: Скидка не может быть больше ста процентов");

  edu_terms_index terms(_edubridge, coopname.value);
  auto it = terms.find(course_id);

  auto fill = [&](edu_terms& t) {
    t.planned_rate      = planned_rate;
    t.per_learner       = per_learner;
    t.target_fee_month  = target_fee_month;
    t.lessons_per_month = lessons_per_month;
    t.lessons_total     = lessons_total;
    t.lesson_minutes    = lesson_minutes;
    t.course_payment    = course_payment;
    t.discount_bp       = discount_bp;
    t.guarantee_secs    = guarantee_secs;
    t.starts_at         = starts_at;
  };

  if (it == terms.end()) {
    terms.emplace(RamPayer::of(terms, coopname), [&](auto& t) {
      t.course_id      = course_id;
      t.subs_active    = 0;
      t.lessons_opened = 0;
      t.open_lesson_id = 0;
      t.subs_locked    = 0;
      fill(t);
    });
  } else {
    if (it->subs_active > 0) {
      eosio::check(it->planned_rate == planned_rate && it->per_learner == per_learner && it->target_fee_month == target_fee_month &&
                     it->lessons_per_month == lessons_per_month && it->lessons_total == lessons_total &&
                     it->lesson_minutes == lesson_minutes && it->discount_bp == discount_bp &&
                     it->guarantee_secs == guarantee_secs,
                   "EDUBRIDGE_COURSE_TERMS_LOCKED: По курсу есть действующие подписки: ставка, способ расчёта с преподавателем, взнос, расписание, скидка и гарантийный срок не меняются");
    }
    eosio::check(it->lessons_opened == 0 || it->starts_at == starts_at,
                 "EDUBRIDGE_COURSE_START_LOCKED: Занятия уже идут: дата начала не меняется");
    terms.modify(it, RamPayer::of(terms, coopname), fill);
  }

  // Скидка за взнос разом съедает только целевой членский взнос: оплата
  // занятий по плановой ставке остаётся целой.
  const edu_terms saved = Edubridge::get_terms_or_fail(coopname, course_id);
  eosio::check(saved.fee_month().amount * static_cast<int64_t>(discount_bp) <=
                 target_fee_month.amount * static_cast<int64_t>(Edubridge::BP_IN_WHOLE),
               "EDUBRIDGE_DISCOUNT_ABOVE_TARGET_FEE: Скидка за взнос разом больше целевого членского взноса");
}
