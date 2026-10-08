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
               "EDUBRIDGE_GUARANTEE_STATEMENT_REQUIRED: Отсутствует заявление об аннулировании подписки по гарантийным условиям");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "EDUBRIDGE_SUBSCRIPTION_NOT_OWNER: Заявление подаёт тот пайщик, которому принадлежит подписка");
  eosio::check(sub->has_plan(), "EDUBRIDGE_SUBSCRIPTION_LEGACY: Подписка открыта до учёта занятий: закройте её действием expiresub");
  eosio::check(!sub->plan.value().claimed,
               "EDUBRIDGE_GUARANTEE_CLAIM_PENDING: По подписке уже рассматривается заявление по гарантийным условиям");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);
  eosio::check(Edubridge::is_guarantee_running(terms, now) && !sub->plan.value().released,
               "EDUBRIDGE_GUARANTEE_EXPIRED: Гарантийный срок группы истёк: заявление по гарантийным условиям не принимается");

  // Взнос участника замораживается до решения совета: если гарантийный срок
  // истечёт за время рассмотрения, преподавателям он не выделяется.
  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) { s.plan.value().claimed = true; });

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "warrclaim"_n,
                                 statement.hash, statement);
}

/**
 * @brief Совет отказал по заявлению об аннулировании подписки по гарантийным условиям.
 *
 * Заморозка взноса снимается, подписка продолжает действовать. Гарантийный
 * срок группы ещё идёт — подписка возвращается к обычному порядку. Срок уже
 * вышел — оплата занятий, проведённых участнику за гарантийный период,
 * преподавателям не выделяется и остаётся на кошельке программы; оплата
 * непроведённых занятий выделяется в резерв преподавателям как у прочих
 * подписок (`o.edu.allot`), удержание уменьшается до суммы возможного
 * возврата (`o.edu.unlock`).
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::warrdecline(eosio::name coopname,
                            eosio::name username,
                            checksum256 sub_hash) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "EDUBRIDGE_SUBSCRIPTION_NOT_OWNER: Подписка принадлежит другому пайщику");
  eosio::check(sub->has_plan() && sub->plan.value().claimed,
               "EDUBRIDGE_GUARANTEE_CLAIM_NOT_FOUND: По подписке нет заявления по гарантийным условиям на рассмотрении");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    auto& plan = s.plan.value();
    plan.claimed = false;
    if (!Edubridge::is_guarantee_running(terms, now)) {
      plan.drop_dues();
      Edubridge::close_guarantee(coopname, terms, s, now);
    }
  });
}
