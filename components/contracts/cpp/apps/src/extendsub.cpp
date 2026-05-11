/**
 * \brief Идемпотентное продление подписки через `charge_intent_id`
 *        (D4, D5; story v2.5/v2.6, FR24).
 * \ingroup public_apps_actions
 *
 * Что делает действие:
 *  1. Требует подпись `catalog_operator @ active`.
 *  2. Валидирует входы: `subscriber`, `package_id` непустые,
 *     `period_seconds > 0`.
 *  3. Находит `regsub` по `(subscriber, package_id)` через secondary
 *     index `bycooppkg`. Если нет — `eosio_assert("subscription not found")`
 *     (вызов до `regsub` — программная ошибка CA-стороны, а не штатный
 *     control-flow).
 *  4. Сверяет `last_charge_intent_id != charge_intent_id`. Если уже
 *     этот intent был применён — `eosio_assert("already extended")`.
 *     Это и есть double-emit prevention уровня цепи (D5):
 *     UUIDv5-детерминированный id + on-chain unique-by-last проверка
 *     закрывают двойное продление при race'ах watcher-recovery
 *     или повторных webhook'ах из кабинета.
 *  5. На успешном пути модифицирует `regsub`:
 *      - `end_at += period_seconds` (extend ОТ текущей границы, не от now —
 *        это важно для непрерывности оплаченных интервалов; см. AR12).
 *      - `last_charge_intent_id = charge_intent_id`.
 *      - `attempt = 0` (счётчик retry'ев сбрасывается на удачном charge'е).
 *      - `updated_at = now`.
 *
 * RAM payer — `catalog_operator` (оператор оплачивает координацию;
 * клиент-кооператив за `regsub`-row не платит).
 */
void apps::extendsub(eosio::name catalog_operator,
                     eosio::name subscriber,
                     eosio::name package_id,
                     uint32_t period_seconds,
                     eosio::checksum256 charge_intent_id) {
  require_auth(catalog_operator);

  eosio::check(subscriber.value != 0, "subscriber must not be empty");
  eosio::check(package_id.value != 0, "package_id must not be empty");
  eosio::check(period_seconds > 0, "period_seconds must be positive");

  subs_index subs(_apps, _apps.value);
  auto by_cooppkg = subs.get_index<"bycooppkg"_n>();
  uint128_t key = ((uint128_t)subscriber.value << 64) | package_id.value;
  auto it = by_cooppkg.find(key);
  eosio::check(it != by_cooppkg.end(), "subscription not found");

  eosio::check(it->last_charge_intent_id != charge_intent_id,
               "already extended");

  auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  by_cooppkg.modify(it, catalog_operator, [&](auto &s) {
    s.end_at = eosio::time_point_sec(s.end_at.sec_since_epoch() + period_seconds);
    s.last_charge_intent_id = charge_intent_id;
    s.attempt = 0;
    s.updated_at = now;
  });
}
