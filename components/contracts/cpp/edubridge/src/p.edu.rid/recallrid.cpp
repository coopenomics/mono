/**
 * @brief Снятие материалов занятия с ответственного хранения без приёма.
 *
 * Два основания. Подтверждённый гарантийный случай внутри срока: заявление в
 * совет не уходит. И заявление, по которому совет решения о приёме не принял
 * (не набрало голосов, истекло): отрицательного протокола у совета не бывает,
 * поэтому отказ оформляется снятием с хранения с указанием основания.
 * В обоих случаях материалы возвращаются преподавателю, паевой взнос не
 * оформляется, паевой фонд не затрагивается — обязательство перед
 * преподавателем и принятый на хранение актив закрываются встречно.
 *
 * Одна ledger2-операция:
 *  - `o.edu.retrid` (BURN с w.edu.hold, Дт 76 / Кт 08).
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение (запись живёт до `acceptrid`
 *    либо `declinerid`, после них снимать нечего);
 *  - основание указано.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::recallrid(eosio::name coopname,
                          checksum256 rid_hash,
                          std::string reason) {
  require_auth(coopname);

  eosio::check(!reason.empty(), "EDUBRIDGE_RECALL_REASON_REQUIRED: Не указано основание снятия материалов с хранения");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);

  const eosio::name username = rid->username;
  const eosio::asset amount  = rid->amount;
  const uint64_t rid_id      = rid->id;

  // Снятые материалы запоминаются: преподаватель вправе провести занятие
  // заново и передать их ещё раз (`reholdrid`) — без повторного расчёта с
  // учениками, той же суммой (решение владельца 01.11.2026).
  edu_recalled_index recalled(_edubridge, coopname.value);
  recalled.emplace(RamPayer::of(recalled, coopname), [&](auto& r) {
    r.id            = get_global_id_in_scope(_edubridge, coopname, "edurecalled"_n);
    r.rid_hash      = rid->rid_hash;
    r.username      = username;
    r.assignment_id = rid->assignment_id;
    r.amount        = amount;
    r.rid_type      = rid->rid_type;
    r.hold_until    = rid->hold_until;
    r.course_id     = rid->course_id;
    r.recalled_at   = eosio::time_point_sec(eosio::current_time_point());
  });

  // ── o.edu.retrid: BURN с w.edu.hold (Дт 76 / Кт 08) ───────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::RELEASE_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, rid_hash,
                 Edubridge::Memo::get_release_rid_memo(rid_id, reason));

  rids.erase(rid);
}
