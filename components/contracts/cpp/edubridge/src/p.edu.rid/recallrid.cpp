/**
 * @brief Расчёт по материалам закрывается без приёма.
 *
 * Запись материалов живёт до одного из двух исходов: результат принят
 * (`acceptrid`) либо кооператив закрыл расчёт без приёма — этим действием.
 * Основания: взнос возвращён преподавателю на доработку (`returnrid`), и
 * повторной подачи не будет; подтверждённый гарантийный случай внутри срока
 * хранения. Срока на закрытие нет, само оно не происходит: решение принимает
 * кооператив и называет основание.
 *
 * Паевой взнос не оформляется, паевой фонд не затрагивается. Взнос
 * преподавателя за рассчитанные занятия лежал в резерве курса и ждал приёма —
 * он переходит на кошелёк программы и остаётся в кооперативе. Подписки
 * участников действие не читает: занятия проведены и оплачены.
 *
 * Операции ledger2, обе под хэшем процесса материалов (rid_hash):
 *  - `o.edu.retrid` (BURN с w.edu.hold, Дт 76 / Кт 08) — материалы на
 *    хранении; возвращённые на доработку уже у преподавателя, проводки нет;
 *  - `o.edu.free` (TRANSFER w.edu.teach → w.edu.fund) — взнос преподавателя
 *    из резерва курса на кошелёк программы, не больше резерва курса.
 *
 * Запись, по которой прежнее действие `refundlesson` уже вернуло оплату
 * занятия в резервы подписок, резерв курса не освобождает: её сумму
 * освобождает закрытие этих подписок.
 *
 * Guards:
 *  - запись материалов с rid_hash существует (живёт до `acceptrid`,
 *    `declinerid` либо этого действия);
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
  const uint64_t course_id   = rid->course_id;
  const bool on_storage      = rid->storage_act_hash != checksum256();
  const bool unwound         = rid->lesson.has_value() && rid->lesson.value().unwound;

  if (on_storage) {
    // ── o.edu.retrid: BURN с w.edu.hold (Дт 76 / Кт 08) ─────────────────
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::RELEASE_EDU_RID,
                   processes::edubridge::RID,
                   amount, username, rid_hash,
                   Edubridge::Memo::get_release_rid_memo(rid_id, reason));
  }

  if (!unwound) {
    // При возврате взносов по гарантийным условиям резерв курса мог быть
    // выделен не полностью — освобождается то, что в нём есть.
    const eosio::asset reserve = Edubridge::get_course_reserve(coopname, course_id);
    const eosio::asset freed   = amount < reserve ? amount : reserve;
    if (freed.amount > 0) {
      // ── o.edu.free: TRANSFER w.edu.teach → w.edu.fund ─────────────────
      Ledger2::apply(_edubridge, coopname,
                     operations::edubridge::FREE_TEACHER_RESERVE,
                     processes::edubridge::RID,
                     freed, coopname, rid_hash,
                     Edubridge::Memo::get_close_rid_reserve_memo(rid_id));
      Edubridge::update_course(coopname, course_id, [&](auto& c) { c.reserve -= freed; });
    }
  }

  rids.erase(rid);
}
