/**
 * @brief Авторизация принятого решения советом
 *
 * Председатель совета утверждает принятое решение протоколом. Транзакцию проводит
 * кооператив (бэкенд ключом кооператива), а согласие председателя закреплено его
 * подписью на протоколе: подпись обязана присутствовать, а её ключ — принадлежать
 * указанному разрешению аккаунта председателя. active — ручная подпись, иное
 * разрешение — подпись робота по включённой автоматизации протоколов этого типа.
 *
 * @param coopname Наименование кооператива
 * @param chairman Наименование председателя совета кооператива
 * @param decision_id Идентификатор решения для авторизации
 * @param document Протокол решения с подписью председателя
 * @param permission Разрешение аккаунта председателя, которому принадлежит ключ подписи
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void soviet::authorize(eosio::name coopname, eosio::name chairman, uint64_t decision_id, document2 document, eosio::name permission) {
  // Авторизует кооператив (действие проводится через бэкенд ключом кооператива).
  // Согласие председателя при этом не теряется: оно подтверждается криптографически
  // его личной подписью на документе и проверкой принадлежности ключа его аккаунту.
  require_auth(coopname);

  boards_index boards(_soviet, coopname.value);
  autosigner_index autosigner(_soviet, coopname.value);
  
  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ не найден");
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(board.is_valid_chairman(chairman), "Только председатель совета может утвердить решение");
  
  eosio::check(decision -> approved == true, "Консенсус совета по решению не достигнут");

  // Все подписи на протоколе действительны, и среди них есть подпись председателя.
  verify_document_or_fail(document, {chairman});

  const signature_info* chairman_signature = nullptr;
  for (const auto& sig : document.signatures) {
    if (sig.signer == chairman) {
      chairman_signature = &sig;
      break;
    }
  }
  eosio::check(chairman_signature != nullptr, "На протоколе нет подписи председателя");

  // Ключ подписи председателя принадлежит указанному разрешению его аккаунта; для
  // разрешения робота — ещё и включена автоматизация протоколов по типу решения.
  Automation::verify_member_signature(coopname, chairman, permission, decision->type, Automation::Kind::authorize,
                                      chairman_signature->signed_hash, chairman_signature->signature,
                                      chairman_signature->public_key);

  // RAM-плательщик — кооператив: транзакцию авторизует coopname (require_auth выше),
  // поэтому увеличивать RAM аккаунта председателя нельзя (он tx не подписывал).
  decisions.modify(decision, coopname, [&](auto &d){
    d.authorized_by = chairman;
    d.authorized = !decision -> authorized;
    d.authorization = document;
  });

  auto signer = autosigner.find(decision -> id);
  
  if (signer != autosigner.end())
    autosigner.erase(signer);

}
