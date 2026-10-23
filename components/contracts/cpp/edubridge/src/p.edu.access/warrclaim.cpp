/**
 * @brief Публикация Заявления об аннулировании Подписки по Гарантийным условиям.
 *
 * Положение о ЦПП «Образование» (п. 4.4.2) даёт участнику право аннулировать
 * подписку, для которой объявлены гарантийные условия, обоснованным
 * заявлением. Заявление (шаблон 3013) рассматривает совет: при удовлетворении
 * подписка закрывается с возвратом всей списанной стоимости на паевой
 * (`cancelsub`), при отказе у участника остаётся обычный отказ от подписки.
 * Здесь заявление публикуется в реестре документов и тем же действием
 * ставится в повестку совета (тип решения `eduguarantee`, hash = sub_hash,
 * документ повестки — это заявление). Совет подписывает протокол (шаблон
 * 3014) — приходит `onwarrauth`, отказывает либо не решает в срок —
 * `onwarrdecl`. Движений средств нет, подписка остаётся действующей.
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

  // Заявление — в реестр документов пакетом процесса подписки (package = sub_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "warrclaim"_n,
                                 sub_hash, statement);

  // Повестка совета: hash = sub_hash, чтобы обратные вызовы нашли подписку;
  // автор повестки — участник, документ — его заявление; протокол 3014 берёт
  // деловые поля из метаданных заявления.
  action(permission_level{_edubridge, "active"_n}, _soviet, "createagenda"_n,
    std::make_tuple(
      coopname,
      username,
      get_valid_soviet_action(_edubridge_guarantee_action),
      sub_hash,
      _edubridge,
      "onwarrauth"_n,
      "onwarrdecl"_n,
      statement,
      std::string("")
    )
  ).send();
}

/**
 * @brief Совет отказал по заявлению об аннулировании подписки по гарантийным условиям.
 *
 * Общий порядок отказа — `Edubridge::decline_guarantee`: его же зовёт
 * обратный вызов совета `onwarrdecl`. Действие оставлено для заявлений,
 * поданных до повестки контракта.
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
  Edubridge::decline_guarantee(coopname, subs, sub);
}

/**
 * @brief Обратный вызов совета: по заявлению об аннулировании подписки по
 * гарантийным условиям отказано либо вопрос снят с повестки по сроку.
 *
 * Подписки могло уже не быть (закрылась, пока совет решал) — тогда снимать
 * нечего, и действие завершается без отказа, чтобы совет закрыл вопрос.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::onwarrdecl(eosio::name coopname,
                           checksum256 hash,
                           std::string reason) {
  require_auth(_soviet);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  auto found = by_hash.find(hash);
  if (found == by_hash.end() || !found->has_plan() || !found->plan.value().claimed) return;
  Edubridge::decline_guarantee(coopname, subs, subs.find(found->id));
}
