/**
 * @brief Расчёт за занятие по одной подписке.
 *
 * Участник с оплаченным доступом на дату занятия оплачивает его из резерва
 * своей подписки. Оплата занятия по плановой ставке уходит из резерва
 * подписки. На курсе с расчётом за каждого участника взнос преподавателя по
 * его ставке прибавляется к сумме занятия с каждой подписки; на курсе с
 * фиксированным расчётом сумма занятия одна и набирается с подписок по
 * очереди. Остаток оплаты занятия поступает на кошелёк программы.
 *
 * Приложение вызывает действие по каждой подписке курса отдельно; контракт
 * считает одну. Число рассчитанных подписок и сумма в записи занятия — срез
 * курса на дату занятия.
 *
 * Движения средств:
 *  - взнос участника уже в резерве преподавателям — `o.edu.free`
 *    (TRANSFER w.edu.teach → w.edu.fund) на разницу до плановой ставки;
 *  - удержание по подписке уменьшается до суммы возможного возврата
 *    (`o.edu.unlock`): занятие проведено, возвращать за него нечего;
 *  - гарантийный срок участника ещё идёт — движений нет: взнос удержан
 *    целиком, взнос преподавателя запоминается в подписке и выделяется в
 *    резерв, когда срок закроется.
 *
 * Guards:
 *  - занятие открыто; подписка — того же курса и ведёт учёт занятий;
 *  - дата занятия внутри оплаченного срока подписки;
 *  - это занятие по подписке ещё не считалось;
 *  - в резерве подписки есть оплата занятия.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::chargelesson(eosio::name coopname,
                             checksum256 rid_hash,
                             checksum256 sub_hash) {
  require_auth(coopname);

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto lessons_by_hash = lessons.get_index<"byhash"_n>();
  auto found = lessons_by_hash.find(rid_hash);
  eosio::check(found != lessons_by_hash.end(), "EDUBRIDGE_LESSON_NOT_OPEN: Занятие с указанным hash не найдено либо расчёт по нему завершён");
  auto lesson = lessons.find(found->id);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->has_plan(), "EDUBRIDGE_SUBSCRIPTION_LEGACY: Подписка открыта до учёта занятий: закройте её и откройте заново");
  eosio::check(sub->course_id == lesson->course_id, "EDUBRIDGE_SUBSCRIPTION_OTHER_COURSE: Подписка открыта на другой курс");

  const auto& plan = sub->plan.value();
  eosio::check(plan.last_lesson < lesson->number, "EDUBRIDGE_LESSON_ALREADY_CHARGED: Расчёт за это занятие по подписке уже прошёл");
  eosio::check(plan.paid_from <= lesson->held_at && lesson->held_at < sub->paid_until,
               "EDUBRIDGE_LESSON_NOT_COVERED: На дату занятия доступ по подписке не оплачен");

  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, lesson->course_id);
  eosio::check(plan.reserve.amount > 0,
               "EDUBRIDGE_SUBSCRIPTION_RESERVE_EMPTY: В резерве подписки нет оплаты занятия");
  // Из резерва подписки уходит оплата занятия по плановой ставке за проведённое
  // время; остатка меньше — уходит остаток, взнос преподавателя — в той же доле.
  const eosio::asset unit = plan.reserve < lesson->unit ? plan.reserve : lesson->unit;
  eosio::asset share = lesson->charge;
  if (unit < lesson->unit) {
    share = eosio::asset(static_cast<int64_t>(static_cast<__int128>(lesson->charge.amount) * unit.amount / lesson->unit.amount), unit.symbol);
  }

  // За каждого участника — взнос по ставке преподавателя с каждой подписки.
  // Фиксированный — сумма занятия одна: её покрывают подписки по очереди
  // расчёта, оплата занятия остальных участников поступает на кошелёк программы.
  eosio::asset charge = share;
  if (!terms.per_learner) {
    const eosio::asset left = lesson->charge - lesson->amount;
    charge = left < share ? left : share;
  }
  const eosio::asset rest = unit - charge;
  // Гарантийный срок не закрыт — взнос удержан целиком, в резерв преподавателям он ещё не выделен.
  const bool locked = !plan.released;

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    auto& p = s.plan.value();
    p.reserve      -= unit;
    p.lessons_done += 1;
    p.last_lesson   = lesson->number;
    if (locked) {
      p.due += charge;
    } else {
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() - unit, s.locked_or_zero());
      // Занятие проведено — возможный возврат уменьшился, удержание освобождается.
      Edubridge::rebalance_lock(coopname, terms, s);
    }
  });

  if (!locked && rest.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::FREE_TEACHER_RESERVE,
                   processes::edubridge::ACCESS,
                   rest, coopname, sub_hash,
                   Edubridge::Memo::get_rate_gap_memo());
    Edubridge::update_course(coopname, lesson->course_id, [&](auto& c) {
      eosio::check(rest <= c.reserve, "EDUBRIDGE_COURSE_RESERVE_INSUFFICIENT: Резерв преподавателям по курсу меньше оплаты занятия");
      c.reserve -= rest;
    });
  }

  lessons.modify(lesson, RamPayer::of(lessons, coopname), [&](auto& l) {
    l.learners += 1;
    l.amount   += charge;
  });
}
