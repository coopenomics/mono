/**
 * @brief Установка единой ставки членского взноса «Стола заказов»
 * (requirement b6 «Экономика КУ»).
 *
 * Ставка одна на весь кооператив — не per-КУ и не per-категория: один и тот
 * же членский взнос вне зависимости от того, на какой кооперативный участок
 * заказ (против спекуляций и конкуренции между участками — решение владельца
 * 2026-06-10). Применяется к заказам, созданным ПОСЛЕ установки: в уже
 * созданных заказах взнос зафиксирован полем Order.membership_fee.
 *
 * Проценты — в долях HUNDR_PERCENTS (1000000 = 100%). Ставка 0 отключает
 * начисление взноса.
 *
 * @note Авторизация требуется от аккаунта: @p coopname (устанавливает
 * администратор со стола администратора).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::setfee(eosio::name coopname, uint64_t membership_fee_percent) {
  require_auth(coopname);

  eosio::check(membership_fee_percent <= HUNDR_PERCENTS,
               "Ставка членского взноса не может превышать 100%");

  mkt_config_singleton cfg(_marketplace, coopname.value);
  auto state = cfg.get_or_default(mkt_config{});
  state.membership_fee_percent = membership_fee_percent;
  cfg.set(state, coopname);
}
