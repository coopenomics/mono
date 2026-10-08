/**
 * @brief Гарантийный срок участника истёк — взнос перестаёт удерживаться целиком.
 *
 * Пока идёт гарантийный срок, взнос удержан весь: возврат по гарантии —
 * полный. После срока остаётся возврат при отказе — половина остаточной
 * стоимости подписки. Действие выделяет оплату занятий в резерв
 * преподавателям и оставляет удержанной только сумму возможного возврата
 * сверх резерва; остальное остаётся на кошельке программы.
 *
 * Дальше удержание уменьшается само, по мере проведения занятий
 * (`chargelesson`). Суммы считает контракт. Приложение вызывает действие по
 * одной подписке.
 *
 * Движения средств:
 *  - `o.edu.unlock` (TRANSFER w.edu.escrow → w.edu.fund) — удержанное сверх
 *    суммы возможного возврата;
 *  - `o.edu.allot` (TRANSFER w.edu.fund → w.edu.teach) — оплата занятий.
 *
 * Guards:
 *  - подписка существует и ведёт учёт занятий;
 *  - гарантийный срок участника истёк и ещё не закрыт.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::unlockfee(eosio::name coopname,
                          checksum256 sub_hash) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->has_plan(), "EDUBRIDGE_SUBSCRIPTION_LEGACY: Подписка открыта до учёта занятий: закройте её и откройте заново");
  eosio::check(!sub->plan.value().released, "EDUBRIDGE_GUARANTEE_ALREADY_CLOSED: Гарантийный срок по подписке уже закрыт");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);
  eosio::check(!Edubridge::is_guarantee_running(terms, *sub, now),
               "EDUBRIDGE_GUARANTEE_RUNNING: Гарантийный срок участника ещё идёт: взнос остаётся удержанным");

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    Edubridge::close_guarantee(coopname, terms, s, now);
  });
}
