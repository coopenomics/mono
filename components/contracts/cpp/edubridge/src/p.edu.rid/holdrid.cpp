/**
 * @brief Преподаватель передаёт материалы занятия кооперативу на
 * ответственное хранение.
 *
 * Открывает процесс p.edu.rid. Работа преподавателя овеществляется
 * материалами занятия: он отчитывается после занятия и подписывает Акт
 * передачи материалов на ответственное хранение (шаблон 3012). Кооператив
 * принимает материалы как объект — паевым взносом они становятся позже, по
 * заявлению преподавателя и решению совета, поэтому весь гарантийный срок
 * курса (`hold_until`) сумма числится за преподавателем на кошельке
 * ответственного хранения.
 *
 * Одна ledger2-операция:
 *  - `o.edu.hold` (ISSUE → w.edu.hold, Дт 08 / Кт 76) — материалы приняты,
 *    у кооператива возникло обязательство перед преподавателем.
 *
 * Guards:
 *  - amount > 0 в _root_govern_symbol; подпись акта валидна (username);
 *  - срок хранения задан курсом и может быть уже истёкшим (гарантия в ноль
 *    дней либо отчёт задним числом) — приёму материалов это не мешает;
 *  - rid_hash ещё не занят;
 *  - преподаватель — активный член кооператива с действующим договором УХД.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::holdrid(eosio::name coopname,
                        eosio::name username,
                        checksum256 rid_hash,
                        uint64_t assignment_id,
                        eosio::asset amount,
                        eosio::name rid_type,
                        eosio::time_point_sec hold_until,
                        document2 act) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Оценка материалов занятия");
  eosio::check(!is_empty_document(act),
               "Отсутствует акт передачи материалов на ответственное хранение");
  verify_document_or_fail(act, { username });
  verify_signer_keys_or_fail(act, username);

  get_participant_or_fail(coopname, username);
  // Материалы принимаются только по действующему договору УХД
  // (подписан преподавателем и председателем — p.edu.teach).
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_rids_index rids(_edubridge, coopname.value);
  auto by_hash = rids.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(),
               "Материалы с указанным hash уже приняты на ответственное хранение");

  // Срок хранения задаётся курсом и отсчитывается от даты занятия, поэтому он
  // может оказаться в прошлом: преподаватель отчитался позже либо гарантия на
  // курсе не объявлена (ноль дней). Материалы принимаются и в этом случае —
  // заявление о паевом взносе всё равно ждёт окончания срока (submitrid).
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
    rid_id             = r.id;
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
