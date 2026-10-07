/**
 * @brief Обратный вызов совета: в приёме паевого взноса РИД отказано либо
 * вопрос снят с повестки по сроку.
 *
 * Отрицательного протокола у совета не бывает, поэтому движений здесь нет:
 * материалы остаются на ответственном хранении, снимает их председатель
 * действием `recallrid` с основанием. Приложение кооператива по этому
 * действию в цепи помечает заявление исходом совета.
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
