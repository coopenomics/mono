/**
 * @brief Условия курса: по ним контракт считает все суммы процесса.
 *
 * Администратор задаёт окна расписания со стоимостью занятия каждого окна,
 * способ расчёта с преподавателем (за каждого участника либо фиксированный за
 * занятие), целевой членский взнос за месяц, минуты занятий, скидку за взнос
 * разом, гарантийный срок и дату начала занятий. Взнос участника, резерв преподавателям, взнос
 * преподавателя за занятие и возврат считаются отсюда.
 *
 * `month_secs` — длина месяца в секундах для стенда разработки со сжатым
 * временем; в работе приложение передаёт 0, и контракт считает месяц
 * четырьмя неделями (28 дней). При действующих подписках она тоже не меняется.
 *
 * При действующих подписках денежные условия не меняются: участники вносили
 * взнос по ним. Дата начала занятий не меняется после первого занятия.
 *
 * Движений средств нет.
 *
 * Guards:
 *  - хотя бы одно окно; стоимость окна и целевой членский взнос в символе кооператива;
 *  - минут занятий в месяц > 0;
 *  - скидка за взнос разом не больше целевого членского взноса;
 *  - при действующих подписках денежные условия прежние.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::setcourse(eosio::name coopname,
                          uint64_t course_id,
                          bool per_learner,
                          eosio::asset target_fee_month,
                          uint32_t minutes_per_month,
                          uint32_t minutes_total,
                          std::vector<edu_slot_terms> slots,
                          bool course_payment,
                          uint32_t discount_bp,
                          uint32_t guarantee_secs,
                          eosio::time_point_sec starts_at,
                          uint32_t month_secs) {
  require_auth(coopname);

  eosio::check(!slots.empty(), "EDUBRIDGE_SCHEDULE_REQUIRED: У курса нет окон расписания");
  for (const auto& s : slots) {
    eosio::check(s.minutes > 0, "EDUBRIDGE_SCHEDULE_MINUTES_INVALID: Длительность окна расписания должна быть больше нуля");
    eosio::check(s.cost.is_valid() && s.cost.amount >= 0 && s.cost.symbol == _root_govern_symbol,
                 "EDUBRIDGE_SLOT_COST_INVALID: Некорректная стоимость занятия окна расписания");
  }
  eosio::check(target_fee_month.is_valid() && target_fee_month.amount >= 0 &&
                 target_fee_month.symbol == _root_govern_symbol,
               "EDUBRIDGE_TARGET_FEE_INVALID: Некорректный целевой членский взнос");
  eosio::check(minutes_per_month > 0, "EDUBRIDGE_MINUTES_PER_MONTH_INVALID: Минут занятий в месяц должно быть больше нуля");
  eosio::check(discount_bp <= Edubridge::BP_IN_WHOLE, "EDUBRIDGE_DISCOUNT_INVALID: Скидка не может быть больше ста процентов");

  edu_terms_index terms(_edubridge, coopname.value);
  auto it = terms.find(course_id);

  auto fill = [&](edu_terms& t) {
    t.slots             = slots;
    t.per_learner       = per_learner;
    t.target_fee_month  = target_fee_month;
    t.minutes_per_month = minutes_per_month;
    t.minutes_total     = minutes_total;
    t.course_payment    = course_payment;
    t.discount_bp       = discount_bp;
    t.guarantee_secs    = guarantee_secs;
    t.starts_at         = starts_at;
    t.month_secs        = month_secs;
  };

  if (it == terms.end()) {
    terms.emplace(RamPayer::of(terms, coopname), [&](auto& t) {
      t.course_id      = course_id;
      t.subs_active    = 0;
      t.minutes_opened = 0;
      t.charging       = 0;
      t.subs_locked    = 0;
      fill(t);
    });
  } else {
    if (it->subs_active > 0) {
      eosio::check(it->slots == slots && it->per_learner == per_learner && it->target_fee_month == target_fee_month &&
                     it->minutes_per_month == minutes_per_month && it->minutes_total == minutes_total &&
                     it->discount_bp == discount_bp &&
                     it->guarantee_secs == guarantee_secs && it->month_len() == month_secs,
                   "EDUBRIDGE_COURSE_TERMS_LOCKED: По курсу есть действующие подписки: окна со стоимостью, способ расчёта с преподавателем, взнос, минуты, скидка и гарантийный срок не меняются");
    }
    eosio::check(it->minutes_opened == 0 || it->starts_at == starts_at,
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
