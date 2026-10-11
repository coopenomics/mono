/**
 * @brief Решение совета об удовлетворении заявления по Гарантийным условиям.
 *
 * Совет удовлетворил заявление участника (п. 4.4.3–4.4.4 Положения о ЦПП
 * «Образование»): подписка аннулируется, весь взнос по ней возвращается в
 * паевой взнос участника. Протокол (шаблон 3014) публикуется в реестре
 * документов и привязывается к заявлению.
 *
 * Сумму возврата берёт контракт — всё собранное по подписке. Возврат
 * обеспечен всегда: взнос участника удержан. Взнос преподавателей за уже
 * проведённые занятия выделяется в резерв курса из средств этого же курса,
 * сколько их есть; средства других курсов не используются.
 *
 * Guards:
 *  - протокол не пустой и целостный;
 *  - подписка существует, принадлежит пайщику и ведёт учёт занятий;
 *  - по подписке завершён расчёт за открытое занятие курса.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::warrgrant(eosio::name coopname,
                          eosio::name username,
                          checksum256 claim_hash,
                          checksum256 sub_hash,
                          document2 decision) {
  require_auth(coopname);

  eosio::check(!is_empty_document(decision),
               "EDUBRIDGE_GUARANTEE_DECISION_REQUIRED: Отсутствует протокол решения совета по заявлению об аннулировании подписки");
  verify_document_or_fail(decision);

  get_participant_or_fail(coopname, username);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "EDUBRIDGE_SUBSCRIPTION_NOT_OWNER: Подписка принадлежит другому пайщику");
  eosio::check(sub->has_plan(), "EDUBRIDGE_SUBSCRIPTION_LEGACY: Подписка открыта до учёта занятий: закройте её действием expiresub");

  Edubridge::grant_guarantee(coopname, subs, sub);

  // Протокол — в реестр документов пакетом процесса подписки (package = sub_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "warrgrant"_n,
                                 sub_hash, decision);
}

/**
 * @brief Обратный вызов совета: заявление об аннулировании подписки по
 * гарантийным условиям удовлетворено.
 *
 * Совет проголосовал, председатель подписал протокол (шаблон 3014) — совет
 * вызывает это действие с протоколом. Подписка аннулируется, весь взнос по
 * ней возвращается в паевой взнос участника; сумму берёт контракт. Протокол
 * публикуется в реестре документов пакетом подписки.
 *
 * Guards:
 *  - вызывает только контракт совета;
 *  - протокол не пустой;
 *  - подписка существует, и по ней рассматривается заявление;
 *  - по подписке завершён расчёт за открытое занятие группы.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::onwarrauth(eosio::name coopname,
                           checksum256 hash,
                           document2 authorization) {
  require_auth(_soviet);
  eosio::check(!is_empty_document(authorization),
               "EDUBRIDGE_GUARANTEE_DECISION_REQUIRED: Отсутствует протокол решения совета по заявлению об аннулировании подписки");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, hash);
  eosio::check(sub->has_plan() && sub->plan.value().claimed,
               "EDUBRIDGE_GUARANTEE_CLAIM_NOT_FOUND: По подписке нет заявления по гарантийным условиям на рассмотрении");
  const eosio::name username = sub->username;

  Edubridge::grant_guarantee(coopname, subs, sub);

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "onwarrauth"_n,
                                 hash, authorization);
}
