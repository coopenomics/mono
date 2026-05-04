/**
 * \brief Опубликовать новый release пакета — атомарный transition.
 * \ingroup public_apps_actions
 *
 * Алгоритм (выполняется в одной транзакции):
 *
 *  1. Проверки: пакет существует; статус — известный; scope согласован
 *     (kind=all → targets пустой; kind=subnet/canary → targets непустой).
 *  2. Выполнить supersede предыдущего active с тем же scope (точное
 *     совпадение `kind` + `targets`). Записывается `superseded_at=now`.
 *     Если кто-то уже superseded — пропускаем.
 *  3. Создать новый row со `status=active`, `superseded_at=0`.
 *  4. Если `scope.kind == "all"_n` — обновить `packages.last_active_version`.
 *  5. Inline-cleanup: пройтись по `bysuperseded`-индексу для этого
 *     пакета и удалить до `CLEANUP_BUDGET_PER_CALL` записей с
 *     `superseded_at < now - RELEASE_RETENTION_SECS`.
 *
 * Это ядро «atomic moderation approve» (FR8): индекс CA + KE.releases
 * — либо обе, либо ни одна. Со стороны blockchain'а — гарантия атомарности
 * в пределах одной транзакции.
 *
 * \note Re-publish одной и той же `version` запрещён: если releases
 *       уже содержит row для (package_id, version) — фейл. Версии
 *       публикуются монотонно вверх; для отката используется
 *       `reactivate(version=старая)`.
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::setrelease(eosio::name coopname,
                      eosio::name package_id,
                      std::string version,
                      Apps::scope_t scope,
                      eosio::checksum256 tarball_sha256,
                      eosio::name moderated_by,
                      std::string meta) {
  require_auth(coopname);

  eosio::check(!version.empty() && version.size() <= 64, "Некорректная version");
  eosio::check(scope.kind == "all"_n || scope.kind == "subnet"_n || scope.kind == "canary"_n,
               "scope.kind должен быть all|subnet|canary");
  if (scope.kind == "all"_n) {
    eosio::check(scope.targets.empty(), "Для scope=all targets должен быть пустым");
  } else {
    eosio::check(!scope.targets.empty(), "Для scope=subnet|canary targets обязателен");
  }

  packages_index packages(_apps, _apps.value);
  auto pkg_it = packages.find(package_id.value);
  eosio::check(pkg_it != packages.end(), "Пакет не зарегистрирован");

  releases_index releases(_apps, _apps.value);
  auto by_pkgstat = releases.get_index<"bypkgstat"_n>();

  auto now_sec = eosio::current_time_point().sec_since_epoch();
  auto now_tps = eosio::time_point_sec(now_sec);

  // Запретить дубликат version — пройтись по всем релизам пакета.
  auto by_pkg = releases.get_index<"bypackage"_n>();
  for (auto rit = by_pkg.lower_bound(package_id.value);
       rit != by_pkg.end() && rit->package_id == package_id;
       ++rit) {
    eosio::check(rit->version != version,
                 "Релиз с такой version уже опубликован — используйте reactivate");
  }

  // Supersede существующих active с тем же scope.
  uint128_t key_active = ((uint128_t)package_id.value << 64) | "active"_n.value;
  auto act_it = by_pkgstat.lower_bound(key_active);
  while (act_it != by_pkgstat.end()
         && ((uint128_t)act_it->package_id.value << 64 | act_it->status.value) == key_active) {
    if (act_it->scope.kind == scope.kind && act_it->scope.targets == scope.targets) {
      // Найден active с тем же scope → supersede.
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

  // Создать новый active.
  uint64_t new_id = get_global_id(_apps, "release"_n);
  releases.emplace(coopname, [&](auto &r) {
    r.id             = new_id;
    r.package_id     = package_id;
    r.version        = version;
    r.scope          = scope;
    r.status         = "active"_n;
    r.published_at   = now_tps;
    r.superseded_at  = eosio::time_point_sec(0);
    r.moderated_by   = moderated_by;
    r.tarball_sha256 = tarball_sha256;
    r.meta           = meta;
  });

  // Обновить last_active_version только для scope=all.
  if (scope.kind == "all"_n) {
    packages.modify(pkg_it, coopname, [&](auto &p) {
      p.last_active_version = version;
      p.updated_at          = now_tps;
    });
  }

  // Inline-cleanup TTL-просроченных superseded для этого пакета.
  uint128_t key_super = ((uint128_t)package_id.value << 64) | "superseded"_n.value;
  uint64_t  threshold = now_sec > Apps::RELEASE_RETENTION_SECS
                          ? now_sec - Apps::RELEASE_RETENTION_SECS
                          : 0;
  uint64_t  removed   = 0;
  auto sup_it = by_pkgstat.lower_bound(key_super);
  while (sup_it != by_pkgstat.end()
         && ((uint128_t)sup_it->package_id.value << 64 | sup_it->status.value) == key_super
         && removed < Apps::CLEANUP_BUDGET_PER_CALL) {
    if (sup_it->superseded_at.sec_since_epoch() < threshold) {
      sup_it = by_pkgstat.erase(sup_it);
      ++removed;
    } else {
      ++sup_it;
    }
  }
}
