/**
 * @brief Председатель совета подписал приложение к договору на курс —
 * вторая подпись. Вызывается контрактом совета после подтверждения
 * одобрения. Двухподписное приложение публикуется в реестре документов
 * (package = annex_hash), запись ожидания стирается: действующие
 * приложения ведёт приложение кооператива по журналу действий.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::apprvannex(eosio::name coopname,
                           eosio::name username,
                           checksum256 annex_hash,
                           document2 approved_document) {
  require_auth(_soviet);

  edu_annexes_index annexes(_edubridge, coopname.value);
  auto annex = Edubridge::get_annex_or_fail(annexes, annex_hash);
  eosio::check(annex->username == username, "Приложение принадлежит другому преподавателю");

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 Names::Edubridge::APPROVE_ANNEX,
                                 annex_hash, approved_document);

  annexes.erase(annex);
}
