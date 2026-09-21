/**
 * @brief Закрытие подписки по истечении оплаченного срока.
 *
 * Запись стирается из RAM: в таблице живут только активные подписки
 * (chain-RAM — рабочее состояние, история доступа — у парсера). Момент
 * истечения определяет кооператив; контракт не требует, чтобы `paid_until`
 * уже наступил, — это позволяет закрыть подписку и досрочно по решению
 * кооператива (например, при выходе пайщика).
 *
 * Оплаченный срок кончился — возвращать по этой подписке больше нечего, и
 * взнос, ещё удержанный до конца гарантийного срока курса, становится
 * свободным (`o.edu.unlock`). Других движений средств нет.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::expiresub(eosio::name coopname,
                          checksum256 sub_hash) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);

  const eosio::asset locked = sub->locked_or_zero();
  if (locked.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::UNLOCK_FEE,
                   processes::edubridge::ACCESS,
                   locked, coopname, sub_hash,
                   Edubridge::Memo::get_unlock_fee_memo());
  }

  subs.erase(sub);
}
