/**
 * @brief Удаление пайщика из кооператива при выходе
 * Стирает запись пайщика из реестра совета по завершении процедуры выхода
 * (после возврата паевого взноса). Зеркало `addpartcpnt`. Если выбывающий
 * пайщик был активным и имел право голоса — уменьшает счётчик активных
 * пайщиков в registrator (как это делает `block`).
 * @param coopname Наименование кооператива
 * @param username Наименование выбывающего пайщика
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::delpartcpnt(eosio::name coopname, eosio::name username) {
  check_auth_and_get_payer_or_fail(contracts_whitelist);

  get_cooperative_or_fail(coopname);

  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  eosio::check(participant != participants.end(), "Пайщик не найден в кооперативе");

  // Если пайщик был активным и имел право голоса — уменьшаем счётчик активных
  // пайщиков (счётчик живёт в registrator, см. block.cpp / decparticpnt.cpp).
  bool had_vote = participant->has_vote;
  bool was_active = participant->status == "accepted"_n;

  if (was_active && had_vote) {
    action(
      permission_level{_soviet, "active"_n},
      _registrator,
      "decparticpnt"_n,
      std::make_tuple(coopname, username)
    ).send();
  }

  participants.erase(participant);
}
