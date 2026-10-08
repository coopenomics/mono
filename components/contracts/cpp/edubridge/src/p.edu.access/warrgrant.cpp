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

  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);
  Edubridge::check_no_pending_lesson(coopname, terms, *sub);

  Edubridge::settle_closing(coopname, *sub, sub->charged_or_zero(), true);
  subs.erase(sub);

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "warrgrant"_n,
                                 claim_hash, decision);
}
