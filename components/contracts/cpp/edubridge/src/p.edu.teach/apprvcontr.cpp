/**
 * @brief Председатель совета подписал договор УХД преподавателя — вторая
 * подпись. Вызывается контрактом совета (`soviet::confirmapprv`) после
 * подтверждения одобрения; подпись председателя уже проверена советом.
 *
 * Договор становится действующим, двухподписный документ публикуется в
 * реестре документов пакетом процесса (package = contract_hash).
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::apprvcontr(eosio::name coopname,
                           eosio::name username,
                           checksum256 contract_hash,
                           document2 approved_document) {
  require_auth(_soviet);

  edu_contracts_index contracts(_edubridge, coopname.value);
  auto by_hash = contracts.get_index<"byhash"_n>();
  auto it = by_hash.find(contract_hash);
  eosio::check(it != by_hash.end(), "Договор с указанным hash не найден");
  eosio::check(it->username == username, "Договор принадлежит другому преподавателю");
  eosio::check(it->status == Edubridge::ContractStatus::PENDING, "Договор уже подписан председателем");

  auto record = contracts.find(it->id);
  contracts.modify(record, _edubridge, [&](auto& c) {
    c.status      = Edubridge::ContractStatus::ACTIVE;
    c.approved_at = eosio::time_point_sec(eosio::current_time_point());
  });

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 Names::Edubridge::APPROVE_CONTRACT,
                                 contract_hash, approved_document);
}
