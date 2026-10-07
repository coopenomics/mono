/**
 * @brief Председатель совета подписал Акт приёма-передачи РИД — вторая
 * подпись. Вызывается контрактом совета (`soviet::confirmapprv`) после
 * подтверждения одобрения; подпись председателя уже проверена советом.
 *
 * Результат принимается в паевой фонд по общему телу приёма
 * (`accept_rid.cpp`): проводки, расчёт из резерва курса, публикация
 * двухподписного акта пакетом процесса, запись стирается. Протокол совета
 * опубликован раньше, при первой подписи (`signridact`).
 *
 * `username` — тот, кто подтвердил одобрение в совете (председатель), а не
 * преподаватель: материалы находятся по hash.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::apprvridact(eosio::name coopname,
                            eosio::name username,
                            checksum256 rid_hash,
                            document2 approved_document) {
  require_auth(_soviet);
  EdubridgeRid::accept(coopname, rid_hash, document2{}, approved_document);
}
