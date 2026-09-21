/**
 * @brief Отказ совета в приёме РИД преподавателя.
 *
 * Совет принял отрицательное решение по заявлению (Протокол, шаблон 3009).
 * Протокол публикуется в реестр документов пакетом процесса, материалы
 * снимаются с ответственного хранения и возвращаются преподавателю.
 *
 * Одна ledger2-операция:
 *  - `o.edu.retrid` (BURN с w.edu.hold, Дт 76 / Кт 08) — обязательство перед
 *    преподавателем и принятый актив закрываются встречно, паевой фонд
 *    остаётся нетронутым.
 *
 * Отказ без решения совета (решение не набрало голосов, истекло) протокола не
 * имеет — такие материалы снимаются с хранения действием `recallrid`.
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение, заявление по ним подано;
 *  - протокол не пустой.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::declinerid(eosio::name coopname,
                           checksum256 rid_hash,
                           document2 decision) {
  require_auth(coopname);

  eosio::check(!is_empty_document(decision),
               "Отсутствует протокол совета об отказе в приёме паевого взноса РИД");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);

  verify_document_or_fail(decision);

  eosio::check(rid->statement_hash != checksum256(),
               "Заявление о паевом взносе по этим материалам ещё не подано — материалы снимаются с хранения без протокола");

  const eosio::name username = rid->username;
  const eosio::asset amount  = rid->amount;
  const uint64_t rid_id      = rid->id;

  // ── o.edu.retrid: BURN с w.edu.hold (Дт 76 / Кт 08) ───────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::RELEASE_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, rid_hash,
                 Edubridge::Memo::get_release_rid_memo(rid_id, "отказ совета в приёме результата"));

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "declinerid"_n, rid_hash, decision);

  rids.erase(rid);
}
