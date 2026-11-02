/**
 * @brief Отказ совета по взносу результатом занятия: ученикам возвращается
 * оплата занятия, номер занятия освобождается.
 *
 * При отчёте о занятии `chargelesson` списал его с подписок учеников: минуты
 * проведены, оплата ушла в резерв преподавателям и, сверх ставки
 * преподавателя, в кошелёк программы. Совет в приёме отказал — материалы
 * снимает `recallrid`, а оплата занятия должна вернуться ученикам: тогда
 * повторный отчёт идёт обычным расчётом, и за занятие ученики платят один раз
 * (решение владельца 02.11.2026). Истории контракт не хранит: всё, что нужно
 * для возврата, лежит в живой записи материалов (`edu_rid.lesson`) и в живых
 * подписках, а запись материалов стирает следующий за этим `recallrid`.
 *
 * Приложение называет подписки группы занятия; контракт возвращает оплату
 * только тем, по которым это занятие рассчитано. Подписка, которой уже нет
 * (закрыта, истекла), пропускается: её расчёты завершены, вернуть некуда.
 *
 * Движения средств по каждой возвращённой подписке:
 *  - оплата занятия снова в резерве подписки (`plan.reserve`, `reserved`);
 *  - часть, ушедшая при расчёте в кошелёк программы, возвращается в резерв
 *    преподавателям — `o.edu.allot` (TRANSFER w.edu.fund → w.edu.teach);
 *  - удержание по подписке выравнивается к возможному возврату — она снова
 *    оплачивает непроведённое занятие (`o.edu.lock` / `o.edu.unlock`).
 *
 * Guards:
 *  - материалы на хранении и по ним подано заявление в совет (путь совета:
 *    рекламация внутри гарантийного срока оплату не возвращает);
 *  - в записи материалов есть занятие и возврат по нему ещё не проводился.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::declinelesson(eosio::name coopname,
                              checksum256 rid_hash,
                              std::vector<checksum256> subs) {
  require_auth(coopname);

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);
  eosio::check(rid->statement_hash != checksum256(),
               "EDUBRIDGE_RID_NOT_SUBMITTED: Заявление по материалам в совет не подано — возврат оплаты занятия только при отказе совета");
  eosio::check(rid->lesson.has_value() && rid->lesson.value().number > 0,
               "EDUBRIDGE_RID_WITHOUT_LESSON: Материалы приняты без записи занятия — возврат оплаты не проводится");
  const Edubridge::edu_rid_lesson info = rid->lesson.value();
  eosio::check(!info.unwound, "EDUBRIDGE_LESSON_ALREADY_UNWOUND: Оплата этого занятия ученикам уже возвращена");

  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, rid->course_id);
  const eosio::asset unit = info.cost;
  // Часть взноса преподавателя, ещё не возвращённая в подписки. На курсе с
  // расчётом за каждого участника с подписки взят ровно info.charge; на курсе
  // с фиксированным расчётом сумма занятия набиралась с подписок по очереди.
  eosio::asset teacher_left = rid->amount;
  eosio::asset to_reserve(0, unit.symbol);

  edu_subscriptions_index subs_index(_edubridge, coopname.value);
  auto subs_by_hash = subs_index.get_index<"byhash"_n>();
  for (const auto& sub_hash : subs) {
    auto found = subs_by_hash.find(sub_hash);
    if (found == subs_by_hash.end()) continue;
    if (found->course_id != rid->course_id || !found->has_plan()) continue;
    if (!found->plan.value().has_charged(info.number)) continue;

    eosio::asset share = terms.per_learner ? info.charge : unit;
    if (share > teacher_left) share = teacher_left;
    teacher_left -= share;
    const eosio::asset fund_part = unit - share;

    auto sub = subs_index.find(found->id);
    subs_index.modify(sub, RamPayer::of(subs_index, coopname), [&](auto& s) {
      auto& p = s.plan.value();
      p.charged.erase(std::remove(p.charged.begin(), p.charged.end(), info.number), p.charged.end());
      p.minutes_done = p.minutes_done > info.minutes ? p.minutes_done - info.minutes : 0;
      p.reserve     += unit;
      s.set_amounts(s.charged_or_zero(), s.reserved_or_zero() + unit, s.locked_or_zero());
      // Занятие снова не проведено — возможный возврат вырос, удержание выравнивается.
      Edubridge::rebalance_lock(coopname, s);
      s.updated_at = eosio::time_point_sec(eosio::current_time_point());
    });

    if (fund_part.amount > 0) {
      Ledger2::apply(_edubridge, coopname,
                     operations::edubridge::ALLOT_TEACHER_RESERVE,
                     processes::edubridge::ACCESS,
                     fund_part, coopname, sub_hash,
                     Edubridge::Memo::get_allot_reserve_memo());
      to_reserve += fund_part;
    }
  }

  if (to_reserve.amount > 0) {
    Edubridge::update_course(coopname, rid->course_id, [&](auto& c) { c.reserve += to_reserve; });
  }

  // Номер и минуты занятия снова свободны: повторный отчёт — обычный расчёт.
  Edubridge::update_terms(coopname, rid->course_id, [&](auto& t) {
    t.minutes_opened = t.minutes_opened > info.minutes ? t.minutes_opened - info.minutes : 0;
    t.drop_number(info.number);
  });

  rids.modify(rid, RamPayer::of(rids, coopname), [&](auto& r) {
    auto l = r.lesson.value();
    l.unwound = true;
    r.lesson.emplace(l);
  });
}
