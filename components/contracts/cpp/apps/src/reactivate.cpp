/**
 * \brief Реактивировать предыдущую версию пакета (FR43).
 * \ingroup public_apps_actions
 *
 * Используется для отката broken release без full re-publish:
 *  - Находит существующий release `(package_id, version)` со статусом
 *    `superseded` или `withdrawn`.
 *  - Текущий active с тем же `scope` → `superseded`.
 *  - Найденный release → `active`, `superseded_at=0`.
 *  - Если scope=all — обновляется `packages.last_active_version`.
 *
 * Окно реактивации ограничено TTL retention (90 дней): за пределами окна
 * superseded-записи уже удалены, и реактивация не возможна — нужен
 * полноценный re-publish.
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::reactivate(eosio::name coopname,
                      eosio::name package_id,
                      std::string version) {
  require_auth(coopname);

  packages_index packages(_apps, _apps.value);
  auto pkg_it = packages.find(package_id.value);
  eosio::check(pkg_it != packages.end(), "Пакет не зарегистрирован");

  releases_index releases(_apps, _apps.value);
  auto by_pkg = releases.get_index<"bypackage"_n>();

  auto now_tps = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  // Найти release под реактивацию.
  auto target = by_pkg.end();
  for (auto rit = by_pkg.lower_bound(package_id.value);
       rit != by_pkg.end() && rit->package_id == package_id;
       ++rit) {
    if (rit->version == version) {
      target = rit;
      break;
    }
  }
  eosio::check(target != by_pkg.end(),
               "Релиз для реактивации не найден — возможно вышел за TTL");
  eosio::check(target->status != "active"_n,
               "Релиз уже active");

  Apps::scope_t target_scope = target->scope;

  // Supersede current active с тем же scope.
  auto by_pkgstat = releases.get_index<"bypkgstat"_n>();
  uint128_t key_active = ((uint128_t)package_id.value << 64) | "active"_n.value;
  auto act_it = by_pkgstat.lower_bound(key_active);
  while (act_it != by_pkgstat.end()
         && ((uint128_t)act_it->package_id.value << 64 | act_it->status.value) == key_active) {
    if (act_it->scope.kind == target_scope.kind && act_it->scope.targets == target_scope.targets) {
      auto stash = act_it;
      ++act_it;
      releases.modify(*stash, coopname, [&](auto &r) {
        r.status        = "superseded"_n;
        r.superseded_at = now_tps;
      });
    } else {
      ++act_it;
    }
  }

  // Поднять target в active.
  by_pkg.modify(target, coopname, [&](auto &r) {
    r.status        = "active"_n;
    r.superseded_at = eosio::time_point_sec(0);
  });

  if (target_scope.kind == "all"_n) {
    packages.modify(pkg_it, coopname, [&](auto &p) {
      p.last_active_version = version;
      p.updated_at          = now_tps;
    });
  }
}
