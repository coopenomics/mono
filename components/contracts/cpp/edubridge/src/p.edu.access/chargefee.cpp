/**
 * @brief Членский взнос участника за период подписки.
 *
 * Сумму считает контракт по условиям курса: помесячный взнос — занятия
 * месяца по плановой ставке и целевой членский взнос; взнос разом — месяцы
 * до конца программы со скидкой курса. Приложение называет только период и
 * сумму из подписанного участником заявления: расхождение с расчётом —
 * отказ, поэтому списывается ровно то, что участник подписал.
 *
 * Тем же действием считается оплаченный срок, а оплата занятий по плановой
 * ставке откладывается в резерв подписки: из него идёт расчёт с
 * преподавателем за каждое проведённое занятие (`chargelesson`).
 *
 * Движения средств:
 *  - `o.edu.fee` (TRANSFER w.edu.member → w.edu.fund) — взнос;
 *  - пока идёт гарантийный срок участника — `o.edu.lock` (w.edu.fund →
 *    w.edu.escrow) на весь взнос;
 *  - срок истёк — `o.edu.allot` (w.edu.fund → w.edu.teach) на оплату занятий
 *    и `o.edu.lock` на сумму возможного возврата сверх резерва.
 *
 * Guards:
 *  - подписка существует, принадлежит пайщику и ведёт учёт занятий;
 *  - ожидаемая сумма равна расчётной;
 *  - на кошельке членских взносов пайщика достаточно средств.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::chargefee(eosio::name coopname,
                          eosio::name username,
                          checksum256 sub_hash,
                          eosio::name period,
                          eosio::asset expected,
                          checksum256 statement_hash) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "EDUBRIDGE_SUBSCRIPTION_NOT_OWNER: Членский взнос списывается у владельца подписки");
  eosio::check(sub->has_plan(), "EDUBRIDGE_SUBSCRIPTION_LEGACY: Подписка открыта до учёта занятий: закройте её и откройте заново");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);
  const Edubridge::FeeQuote quote = Edubridge::quote_fee(terms, *sub, period, now);

  eosio::check(expected == quote.amount,
               std::string{"EDUBRIDGE_FEE_MISMATCH: Сумма взноса в заявлении расходится с расчётом: в заявлении "} +
                 expected.to_string() + ", по условиям курса " + quote.amount.to_string());

  auto bal_member = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::EDU_MEMBER_FEE, username);
  eosio::check(bal_member.available >= quote.amount,
               std::string{"EDUBRIDGE_MEMBER_FUNDS_INSUFFICIENT: Недостаточно членских средств программы: требуется "} +
                 quote.amount.to_string() + ", доступно " + bal_member.available.to_string());

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::COLLECT_EDU_FEE,
                 processes::edubridge::ACCESS,
                 quote.amount, username, sub_hash,
                 Edubridge::Memo::get_collect_fee_memo());

  const bool first = sub->plan.value().lessons_paid == 0;
  const bool guarantee = Edubridge::is_guarantee_running(terms, *sub, now);

  if (guarantee) {
    // Гарантийный срок идёт: взнос удерживается целиком — возврат по гарантии полный.
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::LOCK_FEE,
                   processes::edubridge::ACCESS,
                   quote.amount, coopname, sub_hash,
                   Edubridge::Memo::get_lock_fee_memo());
  } else if (quote.teach.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::ALLOT_TEACHER_RESERVE,
                   processes::edubridge::ACCESS,
                   quote.teach, coopname, sub_hash,
                   Edubridge::Memo::get_allot_reserve_memo());
  }

  Edubridge::update_course(coopname, sub->course_id, [&](auto& c) {
    c.collected += quote.amount;
    if (!guarantee) c.reserve += quote.teach;
    Edubridge::check_course_covered(c);
  });

  subs.modify(sub, RamPayer::of(subs, coopname), [&](auto& s) {
    // Гарантийный срок истёк, а закрыт ещё не был — закрывается до нового взноса.
    Edubridge::close_guarantee(coopname, terms, s, now);

    auto& plan = s.plan.value();
    if (first) plan.paid_from = quote.paid_from;
    plan.lessons_paid += quote.lessons;
    plan.reserve      += quote.teach;

    s.period         = period;
    s.paid_until     = quote.paid_until;
    s.statement_hash = statement_hash;
    s.updated_at     = now;

    if (guarantee) {
      s.set_amounts(s.charged_or_zero() + quote.amount, s.reserved_or_zero(), s.locked_or_zero() + quote.amount);
    } else {
      s.set_amounts(s.charged_or_zero() + quote.amount, s.reserved_or_zero() + quote.teach, s.locked_or_zero());
      // Новый взнос увеличил сумму возможного возврата — удержание приводится к ней.
      Edubridge::rebalance_lock(coopname, s);
    }
  });
}
