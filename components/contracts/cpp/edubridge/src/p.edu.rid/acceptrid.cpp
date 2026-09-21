/**
 * @brief Приём РИД преподавателя в паевой фонд по решению совета и акту.
 *
 * Совет принял положительное решение по заявлению (Протокол, шаблон 3009),
 * преподаватель и председатель подписали Акт приёма-передачи (шаблон 3010).
 * Контракт публикует оба документа в реестр пакетом процесса и проводит
 * паевой взнос.
 *
 * Две ledger2-операции закрывают ответственное хранение:
 *  - `o.edu.rid` (Дт 04 / Кт 08) — результат принят в состав нематериальных
 *    активов кооператива, хранение на счёте вложений закрыто;
 *  - `o.edu.ridshr` (TRANSFER w.edu.hold → w.wal.share, Дт 76 / Кт 80) —
 *    обязательство перед преподавателем гасится признанием паевого фонда,
 *    средства ложатся в его главный паевой кошелёк (право требования;
 *    возврат — штатным createwthd).
 *
 * Запись стирается: в RAM живут только материалы до решения совета.
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение;
 *  - заявление по ним подано (`submitrid`);
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

  // Акт двухподписный: преподаватель подписал первым, председатель совета
  // присоединил свою подпись к тому же документу (по хэшу, без перегенерации).
  // Оба подписанта обязательны, как у акта-2 «Благороста» (capital::signact2).
  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  verify_document_or_fail(decision);
  verify_document_or_fail(act, { username, chairman });
  verify_signer_keys_or_fail(act, username);
  verify_signer_keys_or_fail(act, chairman);
  const eosio::asset amount  = rid->amount;
  const uint64_t rid_id      = rid->id;

  eosio::check(rid->statement_hash != checksum256(),
               "Заявление о паевом взносе по этим материалам ещё не подано");

  // ── o.edu.rid: Дт 04 / Кт 08 — результат принят в состав НМА ──────────
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::ACCEPT_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, act.hash,
                 Edubridge::Memo::get_accept_rid_memo(rid_id));

  // ── o.edu.ridshr: TRANSFER w.edu.hold → w.wal.share (Дт 76 / Кт 80) ───
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::SETTLE_EDU_RID,
                 processes::edubridge::RID,
                 amount, username, act.hash,
                 Edubridge::Memo::get_settle_rid_memo(rid_id));

  // Протокол и акт — в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "acceptrid"_n, rid_hash, decision);
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "acceptrid"_n, rid_hash, act);

  rids.erase(rid);
}
