/**
 * @brief Обратный вызов совета: в приёме паевого взноса РИД отказано либо
 * вопрос снят с повестки по сроку.
 *
 * Отрицательного протокола у совета не бывает, поэтому движений здесь нет.
 * Приложение кооператива по этому действию в цепи возвращает материалы
 * преподавателю на доработку (`returnrid`) с основанием совета.
 *
 * Guards:
 *  - вызывает контракт совета;
 *  - материалы с rid_hash приняты на хранение.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::onriddecl(eosio::name coopname,
                          checksum256 hash,
                          std::string reason) {
  require_auth(_soviet);
  edu_rids_index rids(_edubridge, coopname.value);
  Edubridge::get_rid_or_fail(rids, hash);
}
