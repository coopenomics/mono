/**
 * @brief Доля инициатора участка в экономии месяца (задача 99D-21, КЭУ-3;
 * решение владельца 02.11.2026).
 *
 * Экономия месяца участка — собранная обеспечительная часть минус членский
 * взнос участка с отчислениями в фонды. Доля инициатора идёт на его паевой
 * кошелёк, остальное возвращается пайщикам на свободный паевой Стола заказов.
 * По умолчанию 61,8 % (DEFAULT_INITIATOR_SHARE_PERCENT). Применяется при
 * расчёте прогона (`closeperiod`); прошедшие прогоны не пересчитываются.
 *
 * Guards: авторизация кооператива; доля не выше 100 %.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::setshares(eosio::name coopname, uint64_t initiator_share_percent) {
  require_auth(coopname);

  eosio::check(initiator_share_percent <= HUNDR_PERCENTS,
               "MARKETPLACE_INITIATOR_SHARE_INVALID: Доля инициатора в экономии не может превышать 100%");

  mkt_config_singleton cfg(_marketplace, coopname.value);
  auto state = cfg.get_or_default(mkt_config{});
  if (!cfg.exists()) {
    // Первая запись настроек: ставка обеспечительной части остаётся дефолтной,
    // а не нулём из пустой структуры.
    state.membership_fee_percent = DEFAULT_MEMBERSHIP_FEE_PERCENT;
  }
  state.initiator_share_percent.emplace(initiator_share_percent);
  cfg.set(state, coopname);
}
