/**
 * @brief Отказ совета в приёме РИД преподавателя.
 *
 * Совет принял отрицательное решение по заявлению (Протокол, шаблон 3009).
 * Протокол публикуется в реестр документов пакетом процесса, запись
 * заявления стирается. Движений средств нет.
 *
 * Guards:
 *  - заявление с rid_hash существует;
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

  const eosio::name username = rid->username;

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "declinerid"_n, rid_hash, decision);

  rids.erase(rid);
}
