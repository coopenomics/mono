/**
 * @brief Снятие материалов занятия с ответственного хранения по рекламации.
 *
 * Подтверждённый гарантийный случай внутри срока прекращает приём: материалы
 * возвращаются преподавателю, паевой взнос по ним не оформляется, заявление в
 * совет не уходит. Паевой фонд не затрагивается — обязательство перед
 * преподавателем и принятый на хранение актив закрываются встречно.
 *
 * Одна ledger2-операция:
 *  - `o.edu.retrid` (BURN с w.edu.hold, Дт 76 / Кт 08).
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение;
 *  - решение совета по заявлению ещё не принято (заявление снимается вместе
 *    с материалами — после приёма действует `acceptrid`).
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::recallrid(eosio::name coopname,
                          checksum256 rid_hash,
                          std::string reason) {
  require_auth(coopname);

  eosio::check(!reason.empty(), "Не указано основание рекламации");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);

  const eosio::name username = rid->username;
  const eosio::asset amount  = rid->amount;
  const uint64_t rid_id      = rid->id;

  // ── o.edu.retrid: BURN с w.edu.hold (Дт 76 / Кт 08) ───────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::RELEASE_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, rid_hash,
                 Edubridge::Memo::get_release_rid_memo(rid_id, reason));

  rids.erase(rid);
}
