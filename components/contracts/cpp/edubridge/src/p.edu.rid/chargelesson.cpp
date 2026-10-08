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
 *  - гарантийный срок группы ещё идёт — движений нет: взнос удержан целиком,
 *    взнос преподавателя запоминается в подписке по его допуску, выделяется в
 *    резерв и переходит в сумму допуска, когда подписка закроет срок. Участник,
 *    вернувший взнос по гарантийным условиям, в эту сумму не входит.
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
  const eosio::asset unit = terms.lesson_unit();
  eosio::check(plan.lessons_done < plan.lessons_paid && plan.reserve >= unit,
               "EDUBRIDGE_SUBSCRIPTION_RESERVE_EMPTY: В резерве подписки нет оплаты занятия");

  // За каждого участника — взнос по ставке преподавателя с каждой подписки.
  // Фиксированный — сумма занятия одна: её покрывают подписки по очереди
  // расчёта, оплата занятия остальных участников поступает на кошелёк программы.
  eosio::asset charge = lesson->charge;
  if (!terms.per_learner) {
    const eosio::asset left = lesson->charge - lesson->amount;
    charge = left < unit ? left : unit;
  }
  const eosio::asset rest = unit - charge;
  const auto now = eosio::time_point_sec(eosio::current_time_point());
  // Занятие после гарантийного срока: участник с заявлением по гарантийным
  // условиям на рассмотрении в расчёт не входит — его взнос заморожен.
  eosio::check(lesson->deferred || !plan.claimed,
               "EDUBRIDGE_GUARANTEE_CLAIM_PENDING: По подписке рассматривается заявление по гарантийным условиям: взнос заморожен до решения совета");
  bool locked = false;

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    // Занятие проведено после гарантийного срока, а подписка его ещё не закрыла — закрывается до расчёта.
    if (!lesson->deferred) Edubridge::close_guarantee(coopname, terms, s, now);
    auto& p = s.plan.value();
    // Гарантийный срок не закрыт — взнос удержан целиком, в резерв преподавателям он ещё не выделен.
    locked = !p.released;
    p.reserve      -= unit;
    p.lessons_done += 1;
    p.last_lesson   = lesson->number;
    if (locked) {
      // Взнос преподавателя запоминается в подписке по его допуску: в сумму
      // допуска он перейдёт, когда подписка закроет гарантийный срок.
      p.add_due(lesson->assignment_id, charge);
    } else {
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() - unit, s.locked_or_zero());
      // Занятие проведено — возможный возврат уменьшился, удержание освобождается.
      Edubridge::rebalance_lock(coopname, s);
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

  // Занятие гарантийного срока, а подписка срок уже закрыла: взнос преподавателя — сразу в сумму допуска.
  if (lesson->deferred && !locked && charge.amount > 0) {
    edu_assignments_index assigns(_edubridge, coopname.value);
    auto assign = assigns.find(lesson->assignment_id);
    if (assign != assigns.end()) {
      assigns.modify(assign, RamPayer::of(assigns, coopname), [&](auto& a) { a.deferred += charge; });
    }
  }

  lessons.modify(lesson, RamPayer::of(lessons, coopname), [&](auto& l) {
    l.learners += 1;
    l.amount   += charge;
  });
}
