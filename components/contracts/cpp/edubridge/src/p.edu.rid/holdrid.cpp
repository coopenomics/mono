/**
 * @brief Преподаватель передаёт материалы занятия кооперативу на
 * ответственное хранение — расчёт по занятию завершается.
 *
 * Работа преподавателя овеществляется материалами занятия: он отчитывается
 * после занятия (`openlesson`), приложение проводит расчёт с участниками
 * (`chargelesson`), и преподаватель подписывает Акт передачи материалов на
 * ответственное хранение (шаблон 3012) на сумму из записи занятия.
 *
 * Сумму и срок хранения берёт контракт: сумма — взнос преподавателя за
 * занятие по числу участников с оплаченным доступом, срок — гарантийный срок
 * курса от начала занятий. Кооператив принимает материалы как объект — паевым
 * взносом они становятся позже, по заявлению преподавателя и решению совета.
 *
 * Запись занятия стирается, курс открыт для следующего занятия. Запись
 * материалов запоминает курс: при приёме результат оплачивается из резерва
 * преподавателям этого курса.
 *
 * Одна ledger2-операция:
 *  - `o.edu.hold` (ISSUE → w.edu.hold, Дт 08 / Кт 76) — материалы приняты,
 *    у кооператива возникло обязательство перед преподавателем.
 *
 * Guards:
 *  - занятие открыто этим преподавателем, по нему рассчитан хотя бы один участник;
 *  - подпись акта валидна (username);
 *  - преподаватель — активный член кооператива с действующим договором УХД.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::holdrid(eosio::name coopname,
                        eosio::name username,
                        checksum256 rid_hash,
                        eosio::name rid_type,
                        std::vector<checksum256> pack,
                        document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(act),
               "EDUBRIDGE_STORAGE_ACT_REQUIRED: Отсутствует акт передачи материалов на ответственное хранение");
  verify_document_or_fail(act, { username });
  verify_signer_keys_or_fail(act, username);

  get_participant_or_fail(coopname, username);
  // Материалы принимаются только по действующему договору УХД
  // (подписан преподавателем и председателем — p.edu.teach).
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto lessons_by_hash = lessons.get_index<"byhash"_n>();

  eosio::asset amount(0, _root_govern_symbol);
  uint64_t assignment_id = 0;
  uint64_t course_id = 0;
  eosio::time_point_sec held_at;
  bool single = pack.empty();

  if (single) {
    // Занятие после гарантийного срока: материалы принимаются по одному занятию, сумма — из его расчёта.
    auto lesson = lessons_by_hash.find(rid_hash);
    eosio::check(lesson != lessons_by_hash.end(), "EDUBRIDGE_LESSON_NOT_FOUND: Занятие с указанным hash не найдено");
    eosio::check(lesson->username == username, "EDUBRIDGE_LESSON_NOT_OWNER: Занятие открыто другим преподавателем");
    eosio::check(!lesson->deferred,
                 "EDUBRIDGE_LESSON_DEFERRED: Занятие проведено в гарантийный срок: материалы принимаются после срока, вместе с остальными занятиями периода");
    eosio::check(lesson->amount.amount > 0,
                 "EDUBRIDGE_LESSON_WITHOUT_LEARNERS: На дату занятия нет участников с оплаченным доступом: взнос преподавателя не начислен");
    amount        = lesson->amount;
    assignment_id = lesson->assignment_id;
    course_id     = lesson->course_id;
    held_at       = lesson->held_at;
    lessons_by_hash.erase(lesson);
  } else {
    // Занятия гарантийного срока принимаются разом, одним актом: названы все
    // занятия допуска за период, сумма — накопленная в допуске по подпискам,
    // закрывшим срок. Перебор идёт по названному списку, не по таблице.
    for (const auto& hash : pack) {
      auto lesson = lessons_by_hash.find(hash);
      eosio::check(lesson != lessons_by_hash.end(), "EDUBRIDGE_LESSON_NOT_FOUND: Занятие с указанным hash не найдено");
      eosio::check(lesson->username == username, "EDUBRIDGE_LESSON_NOT_OWNER: Занятие открыто другим преподавателем");
      eosio::check(lesson->deferred, "EDUBRIDGE_LESSON_NOT_DEFERRED: Занятие проведено после гарантийного срока: материалы по нему принимаются отдельно");
      if (assignment_id == 0) {
        assignment_id = lesson->assignment_id;
        course_id     = lesson->course_id;
      }
      eosio::check(lesson->assignment_id == assignment_id, "EDUBRIDGE_LESSON_OTHER_ASSIGNMENT: Занятия относятся к разным допускам");
      if (lesson->held_at > held_at) held_at = lesson->held_at;
      lessons_by_hash.erase(lesson);
    }
  }

  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, course_id);
  const auto now = eosio::time_point_sec(eosio::current_time_point());

  if (!single) {
    eosio::check(!Edubridge::is_guarantee_running(terms, now),
                 "EDUBRIDGE_GUARANTEE_RUNNING: Гарантийный срок группы ещё идёт: материалы занятий периода принимаются после срока");
    eosio::check(terms.subs_locked == 0,
                 "EDUBRIDGE_GUARANTEE_NOT_SETTLED: По группе не закрыт гарантийный срок всех подписок: сумма за занятия периода ещё не окончательна");
    edu_assignments_index assigns(_edubridge, coopname.value);
    auto assign = assigns.find(assignment_id);
    eosio::check(assign != assigns.end() && assign->username == username,
                 "EDUBRIDGE_TEACHER_NOT_ASSIGNED: Преподаватель не допущен к этому курсу");
    eosio::check(assign->deferred_lessons == pack.size(),
                 "EDUBRIDGE_LESSON_PACK_INCOMPLETE: Названы не все занятия гарантийного срока по допуску");
    eosio::check(assign->deferred.amount > 0,
                 "EDUBRIDGE_LESSON_WITHOUT_LEARNERS: За занятия гарантийного срока взнос преподавателя не начислен");
    amount = assign->deferred;
    assigns.modify(assign, RamPayer::of(assigns, coopname), [&](auto& a) {
      a.deferred         = eosio::asset(0, _root_govern_symbol);
      a.deferred_lessons = 0;
    });
  }

  // Срок хранения задаётся курсом и может оказаться в прошлом: гарантия не
  // объявлена либо срок уже вышел. Материалы принимаются и в этом случае.
  const eosio::time_point_sec hold_until = Edubridge::lesson_hold_until(terms, held_at);

  edu_rids_index rids(_edubridge, coopname.value);
  auto by_hash = rids.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(),
               "EDUBRIDGE_RID_ALREADY_HELD: Материалы с указанным hash уже приняты на ответственное хранение");

  uint64_t rid_id = 0;
  rids.emplace(RamPayer::of(rids, coopname), [&](auto& r) {
    r.id               = get_global_id_in_scope(_edubridge, coopname, "edurids"_n);
    r.rid_hash         = rid_hash;
    r.username         = username;
    r.assignment_id    = assignment_id;
    r.amount           = amount;
    r.rid_type         = rid_type;
    r.statement_hash   = checksum256();
    r.storage_act_hash = act.hash;
    r.hold_until       = hold_until;
    r.created_at       = now;
    r.course_id        = course_id;
    rid_id             = r.id;
  });

  // Расчёт по занятию завершён: курс открыт для следующего занятия.
  if (single) {
    Edubridge::update_terms(coopname, course_id, [&](auto& t) {
      t.open_lesson_id = 0;
      t.last_held_at   = held_at;
    });
  }

  // ── o.edu.hold: ISSUE → w.edu.hold (Дт 08 / Кт 76) ────────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::HOLD_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, rid_hash,
                 Edubridge::Memo::get_hold_rid_memo(rid_id));

  // Акт хранения публикуется в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "holdrid"_n,
                                 rid_hash, act);
}
