/**
 * @brief Установка единой ставки обеспечительной части паевого взноса «Стола
 * заказов» (задача 99D-18; поле `membership_fee_percent` — историческое имя).
 *
 * Ставка одна на весь кооператив — не per-КУ и не per-категория: одна и та
 * же обеспечительная часть вне зависимости от того, на какой кооперативный
 * участок заказ (против спекуляций и конкуренции между участками — решение
 * владельца 2026-06-10). Применяется к заказам, созданным ПОСЛЕ установки: в
 * уже созданных заказах сумма зафиксирована полем Order.membership_fee.
 *
 * Проценты — в долях HUNDR_PERCENTS (1000000 = 100%). Ставка 0 отключает
 * обеспечительную часть.
 *
 * @note Авторизация требуется от аккаунта: @p coopname (устанавливает
 * администратор со стола администратора).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::setfee(eosio::name coopname, uint64_t membership_fee_percent) {
  require_auth(coopname);

  eosio::check(membership_fee_percent <= HUNDR_PERCENTS,
               "MARKETPLACE_FEE_PERCENT_INVALID: Ставка обеспечительной части не может превышать 100%");

  mkt_config_singleton cfg(_marketplace, coopname.value);
  auto state = cfg.get_or_default(mkt_config{});
  state.membership_fee_percent = membership_fee_percent;
  cfg.set(state, coopname);
}
