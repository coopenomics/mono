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
                        document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(act),
               "Отсутствует акт передачи материалов на ответственное хранение");
  verify_document_or_fail(act, { username });
  verify_signer_keys_or_fail(act, username);

  get_participant_or_fail(coopname, username);
  // Материалы принимаются только по действующему договору УХД
  // (подписан преподавателем и председателем — p.edu.teach).
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_lessons_index lessons(_edubridge, coopname.value);
  auto lessons_by_hash = lessons.get_index<"byhash"_n>();
  auto lesson = lessons_by_hash.find(rid_hash);
  eosio::check(lesson != lessons_by_hash.end(), "Занятие с указанным hash не найдено");
  eosio::check(lesson->username == username, "Занятие открыто другим преподавателем");
  eosio::check(lesson->amount.amount > 0,
               "На дату занятия нет участников с оплаченным доступом: взнос преподавателя не начислен");

  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, lesson->course_id);
  const eosio::asset amount          = lesson->amount;
  const uint64_t assignment_id       = lesson->assignment_id;
  const uint64_t course_id           = lesson->course_id;
  const eosio::time_point_sec held_at = lesson->held_at;
  // Срок хранения задаётся курсом и может оказаться в прошлом: гарантия не
  // объявлена либо отчёт подан позже. Материалы принимаются и в этом случае —
  // заявление о паевом взносе всё равно ждёт окончания срока (submitrid).
  const eosio::time_point_sec hold_until = Edubridge::lesson_hold_until(terms, held_at);

  edu_rids_index rids(_edubridge, coopname.value);
  auto by_hash = rids.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(),
               "Материалы с указанным hash уже приняты на ответственное хранение");

  const auto now = eosio::time_point_sec(eosio::current_time_point());

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

  // Расчёт по занятию завершён: запись стирается, курс открыт для следующего занятия.
  lessons_by_hash.erase(lesson);
  Edubridge::update_terms(coopname, course_id, [&](auto& t) {
    t.open_lesson_id = 0;
    t.last_held_at   = held_at;
  });

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
