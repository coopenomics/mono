/**
 * @brief Публикация Заявления об аннулировании Подписки по Гарантийным условиям.
 *
 * Положение о ЦПП «Образование» (п. 4.4.2) даёт участнику право аннулировать
 * подписку, для которой объявлены гарантийные условия, обоснованным
 * заявлением. Заявление (шаблон 3013) рассматривает совет: при удовлетворении
 * подписка закрывается с возвратом всей списанной стоимости на паевой
 * (`cancelsub`), при отказе у участника остаётся обычный отказ от подписки.
 * Здесь заявление публикуется в реестре документов — совет и участник видят
 * подписанное основание. Движений средств нет, подписка остаётся действующей.
 *
 * Guards:
 *  - заявление не пустое и подписано ключом самого пайщика;
 *  - пайщик — действующий член кооператива;
 *  - подписка с указанным hash существует и принадлежит этому пайщику.
 *
 * Срок гарантийных условий контракт не проверяет: его объявляет кооператив в
 * карточке курса, и он же принимает заявление к рассмотрению.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::warrclaim(eosio::name coopname,
                          eosio::name username,
                          checksum256 sub_hash,
                          document2 statement) {
  require_auth(coopname);

  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление об аннулировании подписки по гарантийным условиям");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "Заявление подаёт тот пайщик, которому принадлежит подписка");

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "warrclaim"_n,
                                 statement.hash, statement);
}
