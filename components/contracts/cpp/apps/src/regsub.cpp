/**
 * \brief Регистрация или продление подписки кооператива на пакет.
 * \ingroup public_apps_actions
 *
 * Idempotent по `(subscriber, package_id)`:
 *  - Row нет → создаём с `active=true`, `start_at`, `end_at`, `plan`, `chain_id`.
 *  - Row есть → обновляем `plan`, `end_at` = `max(текущее, новое)`,
 *               `active=true`, `chain_id` (на случай миграции коопа
 *               между подсетями), `start_at` оставляем как был
 *               (это маркер «когда вообще началась подписка»).
 *
 * Это поведение специально сознательное: биллинг кабинета ВОСХОД при
 * retry / повторной отправке не должен бояться дубликатов. История
 * выписки подписок остаётся в blockchain trace'ах (Antelope action history),
 * а не в таблице `subs`.
 *
 * \param coopname  провайдер каталога (тот, кто выписывает подписку).
 * \param subscriber  кооператив-подписчик.
 * \param chain_id  подсеть, в которой действует подписка.
 *
 * \note Авторизация: @p coopname @ active. Проверки `chain_id` против
 *       `coops.chain_id` НЕ делаем, потому что:
 *       1) `coops` row может ещё не существовать при первой выдаче подписки;
 *       2) подписка теоретически может быть выдана коопу из другой подсети
 *          (миграция). Лучше доверять биллингу.
 */
void apps::regsub(eosio::name coopname,
                  eosio::name subscriber,
                  eosio::name package_id,
                  eosio::checksum256 chain_id,
                  eosio::name plan,
                  eosio::time_point_sec start_at,
                  eosio::time_point_sec end_at) {
  require_auth(coopname);

  eosio::check(subscriber.value != 0, "subscriber не может быть пустым");
  eosio::check(plan.value != 0, "plan не может быть пустым");
  eosio::check(end_at >= start_at, "end_at должен быть >= start_at");

  packages_index packages(_apps, _apps.value);
  auto pkg_it = packages.find(package_id.value);
  eosio::check(pkg_it != packages.end(), "Пакет не зарегистрирован");

  subs_index subs(_apps, _apps.value);
  auto by_cooppkg = subs.get_index<"bycooppkg"_n>();
  uint128_t key = ((uint128_t)subscriber.value << 64) | package_id.value;
  auto sub_it = by_cooppkg.find(key);

  auto now_tps = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  if (sub_it == by_cooppkg.end()) {
    uint64_t new_id = get_global_id(_apps, "sub"_n);
    subs.emplace(coopname, [&](auto &s) {
      s.id         = new_id;
      s.coopname   = subscriber;
      s.package_id = package_id;
      s.chain_id   = chain_id;
      s.plan       = plan;
      s.active     = true;
      s.start_at   = start_at;
      s.end_at     = end_at;
      s.created_at = now_tps;
      s.updated_at = now_tps;
    });
  } else {
    by_cooppkg.modify(sub_it, coopname, [&](auto &s) {
      s.chain_id   = chain_id;
      s.plan       = plan;
      s.active     = true;
      s.end_at     = end_at > s.end_at ? end_at : s.end_at;
      s.updated_at = now_tps;
    });
  }
}
