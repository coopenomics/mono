/**
 * @brief Повторная передача материалов занятия на ответственное хранение
 * после отказа совета.
 *
 * Совет отказал в приёме паевого взноса результатом, материалы сняты с
 * хранения (`recallrid`) и запомнены в `edurecalled`. Преподаватель провёл
 * занятие заново и подписал новый Акт передачи (3012). Расчёт с учениками
 * не повторяется: занятие уже рассчитано, оплата за него осталась в резерве
 * преподавателям курса. Поэтому сумма, допуск и курс берутся из снятых
 * материалов, а не из записи занятия (решение владельца 01.11.2026: ученики
 * второй раз не платят).
 *
 * Дальше путь прежний: заявление (`submitrid`), решение совета, приём
 * (`acceptrid`) или новый отказ.
 *
 * Одна ledger2-операция:
 *  - `o.edu.hold` (ISSUE → w.edu.hold, Дт 08 / Кт 76) — материалы приняты,
 *    у кооператива снова возникло обязательство перед преподавателем.
 *
 * Guards:
 *  - снятые материалы с prev_rid_hash есть и принадлежат преподавателю;
 *  - подпись акта валидна (username);
 *  - преподаватель — активный член кооператива с действующим договором УХД;
 *  - новый rid_hash ещё не на хранении.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::reholdrid(eosio::name coopname,
                          eosio::name username,
                          checksum256 prev_rid_hash,
                          checksum256 rid_hash,
                          document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(act),
               "EDUBRIDGE_STORAGE_ACT_REQUIRED: Отсутствует акт передачи материалов на ответственное хранение");
  verify_document_or_fail(act, { username });
  verify_signer_keys_or_fail(act, username);
  get_participant_or_fail(coopname, username);
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_recalled_index recalled(_edubridge, coopname.value);
  auto recalled_by_hash = recalled.get_index<"byhash"_n>();
  auto prev = recalled_by_hash.find(prev_rid_hash);
  eosio::check(prev != recalled_by_hash.end(),
               "EDUBRIDGE_RECALLED_NOT_FOUND: Снятые с хранения материалы с указанным hash не найдены");
  eosio::check(prev->username == username, "EDUBRIDGE_LESSON_NOT_OWNER: Материалы приняты от другого преподавателя");
  eosio::check(prev->amount.amount > 0,
               "EDUBRIDGE_LESSON_WITHOUT_LEARNERS: На дату занятия нет участников с оплаченным доступом: взнос преподавателя не начислен");

  edu_rids_index rids(_edubridge, coopname.value);
  auto by_hash = rids.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(),
               "EDUBRIDGE_RID_ALREADY_HELD: Материалы с указанным hash уже приняты на ответственное хранение");

  const eosio::asset amount = prev->amount;
  const auto now = eosio::time_point_sec(eosio::current_time_point());
  uint64_t rid_id = 0;
  rids.emplace(RamPayer::of(rids, coopname), [&](auto& r) {
    r.id               = get_global_id_in_scope(_edubridge, coopname, "edurids"_n);
    r.rid_hash         = rid_hash;
    r.username         = username;
    r.assignment_id    = prev->assignment_id;
    r.amount           = amount;
    r.rid_type         = prev->rid_type;
    r.statement_hash   = checksum256();
    r.storage_act_hash = act.hash;
    // Гарантийный срок курса тот же: занятие проведено в те же даты программы.
    r.hold_until       = prev->hold_until;
    r.created_at       = now;
    r.course_id        = prev->course_id;
    rid_id             = r.id;
  });
  recalled_by_hash.erase(prev);

  // ── o.edu.hold: ISSUE → w.edu.hold (Дт 08 / Кт 76) ────────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::HOLD_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, rid_hash,
                 Edubridge::Memo::get_hold_rid_memo(rid_id));

  // Акт хранения публикуется в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 // Тот же акт 3012, что у первой передачи — тем же именем действия в реестре документов.
                                 "holdrid"_n,
                                 rid_hash, act);
}
