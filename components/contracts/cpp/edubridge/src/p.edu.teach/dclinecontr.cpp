/**
 * @brief Председатель совета отказал в подписи договора УХД. Вызывается
 * контрактом совета (`soviet::declineapprv`). Запись стирается —
 * преподаватель может подписать договор заново; причина остаётся в журнале
 * действий.
 *
 * `username` — тот, кто отказал в совете (председатель), а не преподаватель:
 * договор находится по hash.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::dclinecontr(eosio::name coopname,
                            eosio::name username,
                            checksum256 contract_hash,
                            std::string reason) {
  require_auth(_soviet);

  edu_contracts_index contracts(_edubridge, coopname.value);
  auto by_hash = contracts.get_index<"byhash"_n>();
  auto it = by_hash.find(contract_hash);
  if (it == by_hash.end()) return;
  eosio::check(it->status == Edubridge::ContractStatus::PENDING, "EDUBRIDGE_CONTRACT_ACTIVE: Действующий договор отклонить нельзя");

  contracts.erase(contracts.find(it->id));
}
