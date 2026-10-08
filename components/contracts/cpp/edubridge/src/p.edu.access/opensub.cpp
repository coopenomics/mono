/**
 * @brief Открытие подписки на курс для обучающегося.
 *
 * Создаёт строку подписки без оплаченного срока. Срок, взнос и резерв
 * преподавателям считает `chargefee` — приложение вызывает его той же
 * транзакцией.
 *
 * Движений средств нет.
 *
 * Guards:
 *  - условия курса заданы;
 *  - пайщик — действующий член кооператива;
 *  - подписки с таким hash ещё нет.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::opensub(eosio::name coopname,
                        eosio::name username,
                        checksum256 sub_hash,
                        uint64_t learner_id,
                        uint64_t course_id,
                        checksum256 statement_hash) {
  require_auth(coopname);

  get_participant_or_fail(coopname, username);
  Edubridge::get_terms_or_fail(coopname, course_id);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  eosio::check(by_hash.find(sub_hash) == by_hash.end(),
               "EDUBRIDGE_SUBSCRIPTION_ALREADY_EXISTS: Подписка с указанным hash уже существует");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const eosio::asset zero(0, _root_govern_symbol);

  subs.emplace(RamPayer::of(subs, coopname), [&](auto& s) {
    s.id             = get_global_id_in_scope(_edubridge, coopname, "edusubs"_n);
    s.sub_hash       = sub_hash;
    s.username       = username;
    s.learner_id     = learner_id;
    s.course_id      = course_id;
    s.period         = Edubridge::SubscriptionPeriod::MONTH;
    s.paid_until     = now;
    s.statement_hash = statement_hash;
    s.created_at     = now;
    s.updated_at     = now;
    s.set_amounts(zero, zero, zero);
    Edubridge::edu_sub_plan plan;
    plan.version   = 1;
    plan.paid_from = now;
    plan.reserve   = zero;
    plan.due       = zero;
    s.plan.emplace(plan);
  });

  Edubridge::update_terms(coopname, course_id, [&](auto& t) { t.subs_active += 1; });
}
