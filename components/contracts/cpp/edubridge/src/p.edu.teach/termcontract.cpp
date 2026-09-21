/**
 * @brief Прекращение Договора участия в хозяйственной деятельности.
 *
 * Договор действует, пока преподаватель — пайщик: с выходом из кооператива он
 * прекращается, так же как и по соглашению сторон. Запись стирается — в RAM
 * живут только действующие и ожидающие договоры; вернувшийся пайщик
 * подписывает договор заново.
 *
 * Движений средств нет.
 *
 * Guards:
 *  - у преподавателя есть договор с указанным hash;
 *  - основание указано;
 *  - расчёт закрыт: нет материалов на ответственном хранении и приложений,
 *    ожидающих подписи председателя.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::termcontract(eosio::name coopname,
                             eosio::name username,
                             checksum256 contract_hash,
                             std::string reason) {
  require_auth(coopname);

  eosio::check(!reason.empty(), "Не указано основание прекращения договора");

  edu_contracts_index contracts(_edubridge, coopname.value);
  auto by_hash = contracts.get_index<"byhash"_n>();
  auto it = by_hash.find(contract_hash);
  eosio::check(it != by_hash.end(), "Договор с указанным hash не найден");
  eosio::check(it->username == username, "Договор принадлежит другому преподавателю");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rids_by_user = rids.get_index<"byusername"_n>();
  eosio::check(rids_by_user.find(username.value) == rids_by_user.end(),
               "По материалам занятий преподавателя не закрыт расчёт — договор прекращается после него");

  edu_annexes_index annexes(_edubridge, coopname.value);
  auto annexes_by_user = annexes.get_index<"byusername"_n>();
  eosio::check(annexes_by_user.find(username.value) == annexes_by_user.end(),
               "Приложение к договору ожидает подписи председателя — сначала завершите его рассмотрение");

  contracts.erase(contracts.find(it->id));
}
