/**
 * @brief Отключение автоматизации решений совета
 *
 * Стирает запись члена совета из реестра автоматизаций. После этого робот не может
 * подписать ничего от его имени, даже если ключ разрешения остался в хранилище:
 * контракт больше не признаёт подписи этим разрешением. Само разрешение с аккаунта
 * член совета удаляет отдельно (deleteauth) — контракт чужие разрешения не трогает.
 *
 * @param coopname Наименование кооператива
 * @param board_id Идентификатор совета кооператива
 * @param member Член совета, который отключает автоматизацию
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p member
 */
void soviet::disautomate(eosio::name coopname, uint64_t board_id, eosio::name member) {
  require_auth(member);

  automator_index automator(_soviet, coopname.value);
  auto by_member = automator.get_index<"bymember"_n>();
  auto autom = by_member.find(member.value);

  eosio::check(autom != by_member.end(), "Автоматизация для члена совета не включена");
  eosio::check(autom->board_id == board_id, "Указан неверный идентификатор совета");

  by_member.erase(autom);
}
