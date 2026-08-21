/**
 * @brief Приём РИД преподавателя в паевой фонд по решению совета и акту.
 *
 * Совет принял положительное решение по заявлению (Протокол, шаблон 3009),
 * преподаватель и председатель подписали Акт приёма-передачи (шаблон 3010).
 * Контракт публикует оба документа в реестр пакетом процесса и проводит
 * паевой взнос.
 *
 * Одна ledger2-операция:
 *  - `o.edu.rid` (ISSUE → w.wal.share, Дт 04 / Кт 80) — РИД принимается как
 *    нематериальный актив, преподавателю зачисляется паевой взнос в главный
 *    паевой кошелёк (право требования; возврат — штатным createwthd).
 *
 * Запись заявления стирается: в RAM живут только заявления в ожидании решения.
 *
 * Guards:
 *  - заявление с rid_hash существует;
 *  - протокол и акт не пустые.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::acceptrid(eosio::name coopname,
                          checksum256 rid_hash,
                          document2 decision,
                          document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(decision),
               "Отсутствует протокол совета о приёме паевого взноса РИД");
  eosio::check(!is_empty_document(act),
               "Отсутствует акт приёма-передачи паевого взноса РИД");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);

  const eosio::name username = rid->username;

  // Подписи действительны; акт двухподписный — преподаватель подписывает
  // первым, председатель присоединяет подпись по хэшу того же документа.
  verify_document_or_fail(decision);
  verify_document_or_fail(act, { username });
  const eosio::asset amount  = rid->amount;
  const uint64_t rid_id      = rid->id;

  // ── o.edu.rid: ISSUE → w.wal.share (Дт 04 / Кт 80) ────────────────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::ACCEPT_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, act.hash,
                 Edubridge::Memo::get_accept_rid_memo(rid_id));

  // Протокол и акт — в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "acceptrid"_n, rid_hash, decision);
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "acceptrid"_n, rid_hash, act);

  rids.erase(rid);
}
