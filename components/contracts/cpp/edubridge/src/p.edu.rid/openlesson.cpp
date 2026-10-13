/**
 * @brief Преподаватель отчитался о проведённом занятии — открывается расчёт.
 *
 * Занятие берётся из календаря группы: приложение называет его номер в
 * программе, дату, длительность и окно расписания. Запись занятия фиксирует
 * ставку преподавателя на курсе и стоимость занятия для участника по окну.
 * Учёт идёт в минутах: занятие занимает в программе свои минуты. Взнос
 * преподавателя — его ставка за проведённое время, но не больше стоимости
 * занятия по окну. После отчёта приложение по одной подписке
 * вызывает `chargelesson`, закрывает окно расчёта `closecharge`, затем
 * преподаватель передаёт материалы `holdrid`.
 *
 * Порядка отчётов нет: занятия группы отчитываются в любой очерёдности, у
 * каждого свой номер из календаря. Номер занимается один раз; второй расчёт
 * подписки за тот же номер контракт отклоняет. В гарантийный срок группы
 * занятие закрывается самим отчётом: акт и заявление преподаватель подписывает
 * после срока, одной суммой за все занятия периода. Движений средств нет.
 *
 * Guards:
 *  - допуск принадлежит преподавателю, его договор действует;
 *  - курс активирован, дата занятия — не раньше начала занятий и не в будущем;
 *  - номер занятия ещё не занят;
 *  - минут программы хватает на длительность занятия.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::openlesson(eosio::name coopname,
                           eosio::name username,
                           checksum256 rid_hash,
                           uint64_t assignment_id,
                           eosio::time_point_sec held_at,
                           uint32_t number,
                           uint32_t minutes,
                           uint32_t slot) {
  require_auth(coopname);

  get_participant_or_fail(coopname, username);
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_assignments_index assigns(_edubridge, coopname.value);
  auto assign = assigns.find(assignment_id);
  eosio::check(assign != assigns.end() && assign->username == username,
               "EDUBRIDGE_TEACHER_NOT_ASSIGNED: Преподаватель не допущен к этому курсу");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, assign->course_id);
  // Дата занятия — день без времени: сравнивается с днём начала занятий.
  eosio::check(terms.is_started() && held_at >= Edubridge::day_start(terms.starts_at), "EDUBRIDGE_LESSON_BEFORE_COURSE_START: Занятие не может быть раньше начала занятий курса");
  eosio::check(held_at <= now, "EDUBRIDGE_LESSON_IN_FUTURE: Дата занятия не может быть в будущем");
  eosio::check(number > 0, "EDUBRIDGE_LESSON_NUMBER_INVALID: Номер занятия начинается с единицы");
  eosio::check(!terms.has_number(number), "EDUBRIDGE_LESSON_NUMBER_TAKEN: Занятие с этим номером уже отчитано");
  eosio::check(minutes > 0, "EDUBRIDGE_LESSON_MINUTES_INVALID: Длительность занятия не задана");
  eosio::check(terms.minutes_total == 0 || terms.minutes_opened + minutes <= terms.minutes_total,
               "EDUBRIDGE_LESSONS_PROGRAM_COMPLETED: Минут программы курса на это занятие не осталось");

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto by_hash = lessons.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(), "EDUBRIDGE_LESSON_ALREADY_OPEN: Занятие с указанным hash уже открыто");
  edu_rids_index rids(_edubridge, coopname.value);
  auto rids_by_hash = rids.get_index<"byhash"_n>();
  eosio::check(rids_by_hash.find(rid_hash) == rids_by_hash.end(),
               "EDUBRIDGE_RID_ALREADY_HELD: Материалы с указанным hash уже приняты на ответственное хранение");

  // Стоимость занятия для участника — по окну расписания. Взнос преподавателя
  // — его ставка за проведённое время, не больше этой стоимости: на курсе с
  // расчётом за каждого участника это взнос за одного, на курсе с фиксированным
  // расчётом — за всё занятие.
  const eosio::asset unit = terms.slot_cost(slot, minutes);
  const eosio::asset rate = assign->rate;
  eosio::asset charge(rate.amount * static_cast<int64_t>(minutes) / 60, rate.symbol);
  if (charge > unit) charge = unit;

  // Пока идёт гарантийный срок группы, документов с суммой у преподавателя нет:
  // сумма складывается в допуске по подпискам, закрывшим срок.
  const bool deferred = Edubridge::is_guarantee_running(terms, now);

  lessons.emplace(RamPayer::of(lessons, coopname), [&](auto& l) {
    l.id            = get_global_id_in_scope(_edubridge, coopname, "edulessons"_n);
    l.rid_hash      = rid_hash;
    l.course_id     = assign->course_id;
    l.assignment_id = assignment_id;
    l.username      = username;
    l.number        = number;
    l.held_at       = held_at;
    l.minutes       = minutes;
    l.cost          = unit;
    l.rate          = rate;
    l.charge        = charge;
    l.learners      = 0;
    l.amount        = eosio::asset(0, _root_govern_symbol);
    l.created_at    = now;
    l.deferred      = deferred;
    l.settled       = false;
  });

  Edubridge::update_terms(coopname, assign->course_id, [&](auto& t) {
    t.minutes_opened += minutes;
    t.charging       += 1;
    t.numbers.push_back(number);
  });
  if (deferred) {
    assigns.modify(assign, RamPayer::of(assigns, coopname), [&](auto& a) { a.deferred_lessons += 1; });
  }
}

/**
 * @brief Окно расчёта по занятию закрыто: подписки группы рассчитаны.
 *
 * Пока окно открыто, подписки группы не закрываются — оплата занятия не
 * должна уйти мимо преподавателя. Приложение закрывает окно сразу после
 * расчёта по подпискам, тем же проходом. Повторный вызов ничего не меняет.
 * Движений средств нет.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::closecharge(eosio::name coopname,
                            checksum256 rid_hash) {
  require_auth(coopname);

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto by_hash = lessons.get_index<"byhash"_n>();
  auto found = by_hash.find(rid_hash);
  eosio::check(found != by_hash.end(), "EDUBRIDGE_LESSON_NOT_FOUND: Занятие с указанным hash не найдено");
  if (found->settled) return;

  by_hash.modify(found, RamPayer::of(lessons, coopname), [&](auto& l) { l.settled = true; });
  Edubridge::update_terms(coopname, found->course_id, [&](auto& t) {
    eosio::check(t.charging > 0, "EDUBRIDGE_LESSON_NOT_CHARGING: По группе нет занятий в окне расчёта");
    t.charging -= 1;
  });
}

/**
 * @brief Отзыв отчёта о занятии до расчёта с участниками.
 *
 * Преподаватель ошибся в дате либо длительности, либо на дату занятия нет
 * участников с оплаченным доступом: запись занятия стирается, номер и минуты
 * программы возвращаются группе. После первого расчёта по подписке занятие
 * доводится до конца действием `holdrid`. Движений средств нет.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::droplesson(eosio::name coopname,
                           checksum256 rid_hash) {
  require_auth(coopname);

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto by_hash = lessons.get_index<"byhash"_n>();
  auto found = by_hash.find(rid_hash);
  eosio::check(found != by_hash.end(), "EDUBRIDGE_LESSON_NOT_FOUND: Занятие с указанным hash не найдено");
  eosio::check(found->learners == 0, "EDUBRIDGE_LESSON_ALREADY_CHARGED: По занятию уже прошёл расчёт с участниками");

  if (found->deferred) {
    edu_assignments_index assigns(_edubridge, coopname.value);
    auto assign = assigns.find(found->assignment_id);
    if (assign != assigns.end() && assign->deferred_lessons > 0) {
      assigns.modify(assign, RamPayer::of(assigns, coopname), [&](auto& a) { a.deferred_lessons -= 1; });
    }
  }
  const uint32_t number  = found->number;
  const uint32_t minutes = found->minutes;
  const bool     settled = found->settled;
  Edubridge::update_terms(coopname, found->course_id, [&](auto& t) {
    t.minutes_opened = t.minutes_opened > minutes ? t.minutes_opened - minutes : 0;
    if (!settled && t.charging > 0) t.charging -= 1;
    t.drop_number(number);
  });
  by_hash.erase(found);
}
