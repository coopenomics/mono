/**
 * @brief Преподаватель подписал Акт приёма-передачи (шаблон 3010) — первая
 * подпись. Акт уходит на вторую подпись председателю совета через одобрение
 * (`Soviet::create_approval` → стол председателя, «Запросы одобрений» →
 * `soviet::confirmapprv` → `apprvridact`), как договор УХД (`signcontract`).
 *
 * Протокол совета (3009), которым принято заявление, приходит вместе с актом
 * и публикуется в реестр документов сразу: при второй подписи акт уже
 * принимается по нему. Движений средств на этом шаге нет.
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение и заявление по ним подано;
 *  - акт подписан преподавателем материалов, протокол не пустой.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::signridact(eosio::name coopname,
                           eosio::name username,
                           checksum256 rid_hash,
                           document2 decision,
                           document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(decision),
               "Отсутствует протокол совета о приёме паевого взноса РИД");
  eosio::check(!is_empty_document(act),
               "Отсутствует акт приёма-передачи паевого взноса РИД");
  verify_document_or_fail(decision);
  verify_document_or_fail(act, { username });
  verify_signer_keys_or_fail(act, username);

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);
  eosio::check(rid->username == username,
               "Материалы на ответственном хранении приняты от другого пайщика");
  eosio::check(rid->statement_hash != checksum256(),
               "Заявление о паевом взносе по этим материалам не подано");

  // Протокол — в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "acceptrid"_n, rid_hash, decision);

  // Вторая подпись — председатель совета со стола «Запросы одобрений».
  ::Soviet::create_approval(
    _edubridge,
    coopname,
    username,
    act,
    Names::Edubridge::SIGN_RID_ACT,
    rid_hash,
    _edubridge,
    Names::Edubridge::APPROVE_RID_ACT,
    Names::Edubridge::DECLINE_RID_ACT,
    std::string("")
  );
}
