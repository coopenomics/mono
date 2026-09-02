/**
 * @brief Председатель совета отказал в подписи приложения к договору.
 * Запись ожидания стирается; причина остаётся в журнале действий.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::dclineannex(eosio::name coopname,
                            eosio::name username,
                            checksum256 annex_hash,
                            std::string reason) {
  require_auth(_soviet);

  edu_annexes_index annexes(_edubridge, coopname.value);
  auto idx = annexes.get_index<"byhash"_n>();
  auto it = idx.find(annex_hash);
  if (it == idx.end()) return;
  eosio::check(it->username == username, "Приложение принадлежит другому преподавателю");

  annexes.erase(annexes.find(it->id));
}
