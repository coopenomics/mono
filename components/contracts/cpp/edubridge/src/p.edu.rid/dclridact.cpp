/**
 * @brief Председатель совета отказал в подписи Акта приёма-передачи РИД.
 * Вызывается контрактом совета (`soviet::declineapprv`). Движений средств нет:
 * материалы остаются на ответственном хранении, заявление закрывает
 * председатель протоколом совета (`declinerid`) либо снятием с хранения
 * (`recallrid`); причина остаётся в журнале действий.
 *
 * `username` — тот, кто отказал в совете (председатель), а не преподаватель.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::dclridact(eosio::name coopname,
                          eosio::name username,
                          checksum256 rid_hash,
                          std::string reason) {
  require_auth(_soviet);
  edu_rids_index rids(_edubridge, coopname.value);
  Edubridge::get_rid_or_fail(rids, rid_hash);
}
