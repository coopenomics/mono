/**
 * \brief Деактивировать подписку.
 * \ingroup public_apps_actions
 *
 * Ставит `active=false`. Запись остаётся в таблице — она нужна для
 * аудита истечения и для повторной активации (если кооператив снова
 * подпишется, пойдёт через тот же row через `regsub`-upsert).
 *
 * Cleanup физически просроченных записей (например, истёкших год
 * назад и более не нужных в RAM) — задача отдельного периодического
 * действия. Вне scope MVP.
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::expsub(eosio::name coopname,
                  eosio::name subscriber,
                  eosio::name package_id) {
  require_auth(coopname);

  subs_index subs(_apps, _apps.value);
  auto by_cooppkg = subs.get_index<"bycooppkg"_n>();
  uint128_t key = ((uint128_t)subscriber.value << 64) | package_id.value;
  auto sub_it = by_cooppkg.find(key);
  eosio::check(sub_it != by_cooppkg.end(), "Подписка не найдена");

  auto now_tps = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  by_cooppkg.modify(sub_it, coopname, [&](auto &s) {
    s.active     = false;
    s.updated_at = now_tps;
  });
}
