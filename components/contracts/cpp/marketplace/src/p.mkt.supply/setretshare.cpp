/**
 * @brief Доля пайщиков в экономии месяца участка (задача 99D-35; решение
 * владельца 16.11.2026: два деления экономии — две отдельные настройки).
 *
 * Экономия месяца участка — собранная обеспечительная часть сверх расходов
 * участка. Эта настройка — первое деление: доля пайщиков возвращается им на
 * свободный паевой Стола заказов, остальная экономия делится дальше — фонды
 * накопления, затем инициаторы и фонд социального обеспечения участка (второе
 * деление, `setshares`). По умолчанию 38,2 % (DEFAULT_RETURN_SHARE_PERCENT).
 * Применяется при расчёте итога месяца (`closeperiod`); прошедшие итоги не
 * пересчитываются.
 *
 * Guards: авторизация кооператива; доля не выше 100 %.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::setretshare(eosio::name coopname, uint64_t return_share_percent) {
  require_auth(coopname);

  eosio::check(return_share_percent <= HUNDR_PERCENTS,
               "MARKETPLACE_RETURN_SHARE_INVALID: Доля пайщиков в экономии не может превышать 100%");

  mkt_config_singleton cfg(_marketplace, coopname.value);
  auto state = cfg.get_or_default(mkt_config{});
  if (!cfg.exists()) {
    // Первая запись настроек: ставка обеспечительной части остаётся дефолтной,
    // а не нулём из пустой структуры.
    state.membership_fee_percent = DEFAULT_MEMBERSHIP_FEE_PERCENT;
  }
  // Расширения структуры пишутся подряд: у строки без доли инициатора она
  // записывается значением по умолчанию — иначе вторая настройка встала бы
  // на место первой.
  if (!state.initiator_share_percent.has_value()) {
    state.initiator_share_percent.emplace(DEFAULT_INITIATOR_SHARE_PERCENT);
  }
  state.return_share_percent.emplace(return_share_percent);
  cfg.set(state, coopname);
}
