/**
 * @brief Открытие подписки на курс для обучающегося.
 *
 * Вызывается после конвертации членского взноса (`convert`): фиксирует в
 * RAM рабочее состояние доступа — кто, на какой курс, для какого
 * обучающегося и до какой даты оплатил. `statement_hash` связывает подписку
 * с Заявлением о конвертации, по которому оплачен первый период.
 *
 * Движений средств нет. Анкер процесса p.edu.access — `sub_hash`.
 *
 * Guards:
 *  - period ∈ {month, year};
 *  - sub_hash ещё не занят;
 *  - paid_until в будущем;
 *  - пайщик — активный член кооператива.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::opensub(eosio::name coopname,
                        eosio::name username,
                        checksum256 sub_hash,
                        uint64_t learner_id,
                        uint64_t course_id,
                        eosio::name period,
                        eosio::time_point_sec paid_until,
                        checksum256 statement_hash) {
  require_auth(coopname);

  eosio::check(Edubridge::SubscriptionPeriod::is_valid(period),
               "Недопустимый период подписки: ожидается month или year");

  const auto now = eosio::current_time_point();
  eosio::check(paid_until > eosio::time_point_sec(now),
               "Срок оплаты подписки должен быть в будущем");

  get_participant_or_fail(coopname, username);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_hash = subs.get_index<"byhash"_n>();
  eosio::check(by_hash.find(sub_hash) == by_hash.end(),
               "Подписка с указанным hash уже существует");

  subs.emplace(_edubridge, [&](auto& s) {
    s.id             = get_global_id_in_scope(_edubridge, coopname, "edusubs"_n);
    s.sub_hash       = sub_hash;
    s.username       = username;
    s.learner_id     = learner_id;
    s.course_id      = course_id;
    s.period         = period;
    s.paid_until     = paid_until;
    s.statement_hash = statement_hash;
    s.created_at     = eosio::time_point_sec(now);
    s.updated_at     = eosio::time_point_sec(now);
  });
}
