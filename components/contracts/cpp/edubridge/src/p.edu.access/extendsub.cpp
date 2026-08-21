/**
 * @brief Продление подписки на курс.
 *
 * Вызывается после очередной конвертации членского взноса (`convert`) за
 * следующий период: сдвигает `paid_until` вперёд и запоминает hash
 * Заявления о конвертации, по которому оплачен новый период.
 *
 * Движений средств нет.
 *
 * Guards:
 *  - подписка с sub_hash существует;
 *  - новый paid_until строго больше прежнего.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::extendsub(eosio::name coopname,
                          checksum256 sub_hash,
                          eosio::time_point_sec paid_until,
                          checksum256 statement_hash) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);

  eosio::check(paid_until > sub->paid_until,
               "Новый срок оплаты должен быть позже текущего");

  subs.modify(sub, _edubridge, [&](auto& s) {
    s.paid_until     = paid_until;
    s.statement_hash = statement_hash;
    s.updated_at     = eosio::time_point_sec(eosio::current_time_point());
  });
}
