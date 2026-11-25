/**
 * @brief Взнос преподавателя не принят — материалы возвращаются ему на
 * доработку.
 *
 * Один путь для любого исхода без приёма: совет отказал, срок вопроса в
 * повестке вышел, председатель не подписал акт приёма-передачи; одно занятие
 * либо занятия гарантийного срока одной суммой. Расчёт занятия с участниками
 * при этом не меняется: занятие проведено и оплачено, подписки действие не
 * читает и не правит (решение владельца 25.11.2026).
 *
 * Материалы снимаются с ответственного хранения и возвращаются преподавателю.
 * Запись материалов остаётся: взнос преподавателя по ней лежит в резерве
 * курса и ждёт повторной подачи. Срока на неё нет. Преподаватель правит
 * материалы, передаёт их на хранение новым актом (`holdrid` с тем же
 * rid_hash) и подаёт заявление (`submitrid`). Без приёма запись закрывает
 * только кооператив — `recallrid`.
 *
 * Фаза записи читается по её полям: `storage_act_hash` пуст — материалы у
 * преподавателя, заполнен — на хранении.
 *
 * Одна ledger2-операция:
 *  - `o.edu.retrid` (BURN с w.edu.hold, Дт 76 / Кт 08).
 *
 * Guards:
 *  - материалы с rid_hash на хранении, заявление по ним подано;
 *  - основание указано.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::returnrid(eosio::name coopname,
                          checksum256 rid_hash,
                          std::string reason) {
  require_auth(coopname);

  eosio::check(!reason.empty(), "EDUBRIDGE_RETURN_REASON_REQUIRED: Не указано основание возврата материалов на доработку");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);
  eosio::check(rid->storage_act_hash != checksum256(),
               "EDUBRIDGE_RID_ALREADY_RETURNED: Материалы уже возвращены преподавателю на доработку");
  eosio::check(rid->statement_hash != checksum256(),
               "EDUBRIDGE_RID_STATEMENT_NOT_SUBMITTED: Заявление о паевом взносе по этим материалам не подано — возвращать на доработку нечего");

  // ── o.edu.retrid: BURN с w.edu.hold (Дт 76 / Кт 08) ───────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::RELEASE_EDU_RID,
                 processes::edubridge::RID,
                 rid->amount, rid->username, rid_hash,
                 Edubridge::Memo::get_release_rid_memo(rid->id, reason));

  rids.modify(rid, RamPayer::of(rids, coopname), [&](auto& r) {
    r.statement_hash   = checksum256();
    r.storage_act_hash = checksum256();
  });
}
