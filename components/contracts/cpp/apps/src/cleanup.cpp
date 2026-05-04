/**
 * \brief Ручной cleanup TTL-просроченных `superseded`-записей пакета.
 * \ingroup public_apps_actions
 *
 * Используется когда `setrelease` для пакета давно не вызывался, и
 * inline-cleanup в нём не подметает хвост. Удаляет до
 * `CLEANUP_BUDGET_PER_CALL` записей с `status=superseded` и
 * `superseded_at < now - RELEASE_RETENTION_SECS`.
 *
 * Идемпотентно. Многократные вызовы безопасны: каждый вызов чистит свой
 * batch до budget'а.
 *
 * \note БЕЗ авторизации: операция доброкачественная, удаляет только
 *       уже невидимые в продакшене записи, не меняет логику. Любой
 *       может вызвать (и заплатить за CPU). Это снижает оперативную
 *       нагрузку на оператора каталога.
 */
void apps::cleanup(eosio::name package_id) {
  releases_index releases(_apps, _apps.value);
  auto by_pkgstat = releases.get_index<"bypkgstat"_n>();

  auto now_sec   = eosio::current_time_point().sec_since_epoch();
  uint64_t threshold = now_sec > Apps::RELEASE_RETENTION_SECS
                         ? now_sec - Apps::RELEASE_RETENTION_SECS
                         : 0;

  uint128_t key_super = ((uint128_t)package_id.value << 64) | "superseded"_n.value;
  uint64_t  removed   = 0;

  auto it = by_pkgstat.lower_bound(key_super);
  while (it != by_pkgstat.end()
         && ((uint128_t)it->package_id.value << 64 | it->status.value) == key_super
         && removed < Apps::CLEANUP_BUDGET_PER_CALL) {
    if (it->superseded_at.sec_since_epoch() < threshold) {
      it = by_pkgstat.erase(it);
      ++removed;
    } else {
      ++it;
    }
  }
}
