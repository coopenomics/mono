/**
 * @brief Отмена подписки на курс с возвратом членского взноса.
 *
 * Основание и сумму возврата определяет контракт:
 *  - кооператив отменил курс по недобору (`underfilled`) — взнос целиком и
 *    сразу в паевой взнос: это отмена решения кооператива;
 *  - занятия ещё не начались — взнос целиком на кошелёк членских взносов;
 *  - отказ в ходе подписки — половина остаточной стоимости подписки
 *    (`Edubridge::refusal_refund`): доля всего взноса за занятия, по которым
 *    расчёт ещё не прошёл.
 *
 * Остаток по подписке расходится тем же действием: резерв за непроведённые
 * занятия возвращается на кошелёк программы, взнос преподавателей за
 * проведённые занятия остаётся в резерве курса.
 *
 * Guards:
 *  - подписка существует, принадлежит пайщику и ведёт учёт занятий;
 *  - по подписке завершён расчёт за открытое занятие курса;
 *  - отмена по недобору — только до первого занятия.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::cancelsub(eosio::name coopname,
                          eosio::name username,
                          checksum256 sub_hash,
                          bool underfilled) {
  require_auth(coopname);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "EDUBRIDGE_SUBSCRIPTION_NOT_OWNER: Подписку отменяет тот пайщик, которому она принадлежит");
  eosio::check(sub->has_plan(), "EDUBRIDGE_SUBSCRIPTION_LEGACY: Подписка открыта до учёта занятий: закройте её действием expiresub");

  eosio::check(!sub->plan.value().claimed,
               "EDUBRIDGE_GUARANTEE_CLAIM_PENDING: По подписке рассматривается заявление по гарантийным условиям: отказ оформляется после решения совета");

  const auto now = eosio::time_point_sec(eosio::current_time_point());
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, sub->course_id);
  Edubridge::check_no_pending_lesson(coopname, terms, *sub);

  eosio::asset refund;
  bool to_share = false;
  if (underfilled) {
    eosio::check(sub->plan.value().lessons_done == 0, "EDUBRIDGE_UNDERFILL_AFTER_LESSONS: Отмена по недобору возможна только до первого занятия");
    refund = sub->charged_or_zero();
    to_share = true;
  } else if (!terms.is_started() || now < terms.starts_at) {
    refund = sub->charged_or_zero();
  } else {
    refund = Edubridge::refusal_refund(*sub);
  }

  Edubridge::settle_closing(coopname, *sub, refund, to_share);
  subs.erase(sub);
}
