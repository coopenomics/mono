/**
 * @brief Преподаватель отчитался о проведённом занятии — открывается расчёт.
 *
 * Запись занятия фиксирует дату, длительность и ставку преподавателя на
 * курсе. Взнос преподавателя за одного участника — его ставка за проведённое
 * время, но не больше оплаты занятия по плановой ставке курса. После этого
 * приложение по одной подписке вызывает `chargelesson`, затем `holdrid`.
 *
 * Занятия курса идут по порядку: следующее открывается, когда расчёт по
 * предыдущему завершён. Движений средств нет.
 *
 * Guards:
 *  - допуск принадлежит преподавателю, его договор действует;
 *  - курс активирован, дата занятия — не раньше начала занятий и не в будущем;
 *  - дата не раньше предыдущего занятия курса;
 *  - расчёт по предыдущему занятию завершён;
 *  - номер занятия не выходит за программу курса.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::openlesson(eosio::name coopname,
                           eosio::name username,
                           checksum256 rid_hash,
                           uint64_t assignment_id,
                           eosio::time_point_sec held_at,
                           uint32_t minutes) {
  require_auth(coopname);

  eosio::check(minutes > 0, "EDUBRIDGE_LESSON_MINUTES_INVALID: Длительность занятия должна быть больше нуля");
  get_participant_or_fail(coopname, username);
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_assignments_index assigns(_edubridge, coopname.value);
  auto assign = assigns.find(assignment_id);
  eosio::check(assign != assigns.end() && assign->username == username,
               "EDUBRIDGE_TEACHER_NOT_ASSIGNED: Преподаватель не допущен к этому курсу");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, assign->course_id);
  eosio::check(terms.open_lesson_id == 0, "EDUBRIDGE_LESSON_PREVIOUS_OPEN: Расчёт по предыдущему занятию курса не завершён");
  eosio::check(terms.is_started() && held_at >= terms.starts_at, "EDUBRIDGE_LESSON_BEFORE_COURSE_START: Занятие не может быть раньше начала занятий курса");
  eosio::check(held_at <= now, "EDUBRIDGE_LESSON_IN_FUTURE: Дата занятия не может быть в будущем");
  eosio::check(held_at >= terms.last_held_at, "EDUBRIDGE_LESSON_DATE_ORDER: Занятия курса отчитываются по порядку дат");
  eosio::check(terms.lessons_total == 0 || terms.lessons_opened < terms.lessons_total,
               "EDUBRIDGE_LESSONS_PROGRAM_COMPLETED: Все занятия программы курса уже проведены");

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto by_hash = lessons.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(), "EDUBRIDGE_LESSON_ALREADY_OPEN: Занятие с указанным hash уже открыто");
  edu_rids_index rids(_edubridge, coopname.value);
  auto rids_by_hash = rids.get_index<"byhash"_n>();
  eosio::check(rids_by_hash.find(rid_hash) == rids_by_hash.end(),
               "EDUBRIDGE_RID_ALREADY_HELD: Материалы с указанным hash уже приняты на ответственное хранение");

  // Ставка преподавателя за проведённое время, не больше оплаты занятия,
  // заложенной во взнос участника: на курсе с расчётом за каждого участника
  // это взнос за одного, на курсе с фиксированным расчётом — за всё занятие.
  const eosio::asset unit = terms.lesson_unit();
  const eosio::asset rate = assign->rate <= terms.planned_rate ? assign->rate : terms.planned_rate;
  eosio::asset charge(rate.amount * static_cast<int64_t>(minutes) / 60, rate.symbol);
  if (charge > unit) charge = unit;

  uint64_t lesson_id = 0;
  lessons.emplace(RamPayer::of(lessons, coopname), [&](auto& l) {
    l.id            = get_global_id_in_scope(_edubridge, coopname, "edulessons"_n);
    l.rid_hash      = rid_hash;
    l.course_id     = assign->course_id;
    l.assignment_id = assignment_id;
    l.username      = username;
    l.number        = terms.lessons_opened + 1;
    l.held_at       = held_at;
    l.minutes       = minutes;
    l.rate          = rate;
    l.charge        = charge;
    l.learners      = 0;
    l.amount        = eosio::asset(0, _root_govern_symbol);
    l.created_at    = now;
    lesson_id       = l.id;
  });

  Edubridge::update_terms(coopname, assign->course_id, [&](auto& t) {
    t.lessons_opened += 1;
    t.open_lesson_id  = lesson_id;
  });
}

/**
 * @brief Отзыв отчёта о занятии до расчёта с участниками.
 *
 * Преподаватель ошибся в дате либо длительности: запись занятия стирается,
 * номер возвращается курсу. После первого расчёта по подписке занятие
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

  Edubridge::update_terms(coopname, found->course_id, [&](auto& t) {
    t.lessons_opened -= 1;
    t.open_lesson_id  = 0;
  });
  by_hash.erase(found);
}
