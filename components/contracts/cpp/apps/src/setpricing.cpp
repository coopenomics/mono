/**
 * \brief Установка ставки плана для пакета (per-plan upsert) с валидацией (Story v2.1.2).
 * \ingroup public_apps_actions
 *
 * Что делает действие:
 *  1. Требует `apps@active` — `require_auth(get_self())`.
 *  2. Валидирует входы: `package_id` и `plan` непустые (FR4 — сама длина
 *     ≤ 13 уже гарантирована типом `eosio::name`, но `name(0)` — особое
 *     значение «отсутствие», его явно отсекаем для удобной ошибки).
 *  3. Валидирует `hourly_rate.amount > 0` (FR1) — отрицательная или
 *     нулевая ставка не имеет экономического смысла и блокирует
 *     корректный расчёт `charge.required` в watcher'е.
 *  4. В таблице `pricings` (scope = `package_id`) находит запись по `plan`:
 *      - row нет → `emplace` с переданными `hourly_rate` и `updated_at = now`.
 *      - row есть → `modify`: обновляет `hourly_rate` и `updated_at`.
 *
 * **Snapshot policy (FR2, journal-less invariant).** Действие НИКОГДА не
 * трогает таблицу `subs`: поле `regsub.end_at` существующих подписок
 * остаётся как есть — перерасчёта прошлого нет. Текущий оплаченный
 * период подписок зафиксирован в момент `regsub`/`extendsub` по тогдашней
 * ставке, и ретро-изменения тарифа на него не влияют. Snapshot для
 * audit-журнала живёт off-chain в `audit_log_admin` (журнал-less
 * инвариант — на цепи нет log-таблиц, история восстанавливается из
 * trace'ов Antelope).
 *
 * Что **намеренно не валидируется здесь:**
 *  - Символ `hourly_rate.symbol` против `_root_govern_symbol` (`RUB,4`).
 *    Cross-currency расчёт не предусмотрен MVP, но жёсткая привязка
 *    к одному символу даст ложноотрицательные ошибки при будущих
 *    multi-currency сценариях. Адаптер CA-стороны нормализует символ
 *    до отправки.
 *  - Whitelist имён `plan`. В MVP только `default`, но on-chain
 *    хранилище должно оставаться открытым для будущих tier-планов
 *    без миграции контракта.
 *
 * RAM payer — `get_self()` (`apps`-контракт). Фактически платит ВОСХОД
 * как owner аккаунта `apps`; pricing-таблицы — часть координационной
 * плоскости, оплачиваемой оператором каталога.
 */
void apps::setpricing(eosio::name package_id,
                      eosio::name plan,
                      eosio::asset hourly_rate) {
  require_auth(get_self());

  eosio::check(package_id.value != 0, "package_id must not be empty");
  eosio::check(plan.value != 0, "plan must not be empty");
  eosio::check(hourly_rate.amount > 0, "hourly_rate must be positive");

  pricings_index pricings(get_self(), package_id.value);
  auto it = pricings.find(plan.value);
  auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  if (it == pricings.end()) {
    pricings.emplace(get_self(), [&](auto &p) {
      p.plan        = plan;
      p.hourly_rate = hourly_rate;
      p.updated_at  = now;
    });
  } else {
    pricings.modify(it, get_self(), [&](auto &p) {
      p.hourly_rate = hourly_rate;
      p.updated_at  = now;
    });
  }
}
