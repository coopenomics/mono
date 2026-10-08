/**
 * @brief Приём РИД преподавателя в паевой фонд по решению совета и акту —
 * акт с двумя подписями приносит кооператив.
 *
 * Совет принял положительное решение по заявлению (Протокол, шаблон 3009),
 * преподаватель и председатель подписали Акт приёма-передачи (шаблон 3010).
 * Контракт публикует оба документа в реестр пакетом процесса и проводит
 * паевой взнос — тело приёма общее с `apprvridact`, см. `accept_rid.cpp`.
 *
 * Штатный путь второй подписи — одобрение совета (`signridact` →
 * «Запросы одобрений» → `apprvridact`); это действие остаётся для приёма
 * акта, подписанного обеими сторонами вне одобрения.
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение;
 *  - заявление по ним подано (`submitrid`);
 *  - протокол и акт не пустые, на акте подписи преподавателя и председателя;
 *  - резерв выплат преподавателям по курсу результата не меньше его суммы.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::acceptrid(eosio::name coopname,
                          checksum256 rid_hash,
                          document2 decision,
                          document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(decision),
               "EDUBRIDGE_RID_DECISION_REQUIRED: Отсутствует протокол совета о приёме паевого взноса РИД");
  verify_document_or_fail(decision);

  EdubridgeRid::accept(coopname, rid_hash, decision, act);
}
