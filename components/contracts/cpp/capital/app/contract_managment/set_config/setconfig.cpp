/**
 * @brief Устанавливает конфигурацию кооператива
 * Обновляет глобальное состояние контракта для указанного кооператива:
 * - Валидирует параметры конфигурации (проценты, периоды, лимиты)
 * - Создает новую запись конфигурации если отсутствует
 * - Модифицирует существующую конфигурацию
 * @param coopname Имя кооператива
 * @param config Новая конфигурация кооператива
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::setconfig(eosio::name coopname, Capital::config config) {
  require_auth(coopname);
  
  eosio::check(config.coordinator_bonus_percent >= 0.0 && config.coordinator_bonus_percent <= 10, "Координатор не может получить больше 0.1 (10%) от инвестиций");
  eosio::check(config.expense_pool_percent >= 0.0 && config.expense_pool_percent <= 100, "Процент инвестиций в пул расходов должен быть между 0 и 1 (100%)");
  eosio::check(config.coordinator_invite_validity_days >= 0, "Срок действия приглашения координатора должен быть не отрицательным числом дней");
  eosio::check(config.voting_period_in_days >= 1 && config.voting_period_in_days <= 30, "Период голосования должен быть между 1 и 30 днями");
  eosio::check(config.authors_voting_percent >= 0.0 && config.authors_voting_percent <= 100, "Процент премий авторов на голосовании должен быть между 0 и 100");
  eosio::check(config.creators_voting_percent >= 0.0 && config.creators_voting_percent <= 100, "Процент премий создателей на голосовании должен быть между 0 и 100");
  
  // Валидация параметров геймификации
  eosio::check(config.energy_decay_rate_per_day >= 0.0 && config.energy_decay_rate_per_day <= 100.0, 
               "Скорость уменьшения энергии должна быть между 0 и 100% в день");
  eosio::check(config.level_depth_base > 0, 
               "Базовая сумма для уровня должна быть положительной");
  eosio::check(config.level_growth_coefficient >= 1.0 && config.level_growth_coefficient <= 3.0, 
               "Коэффициент роста уровней должен быть между 1.0 и 3.0");
  eosio::check(config.energy_gain_coefficient > 0.0 && config.energy_gain_coefficient <= 100.0, 
               "Коэффициент прироста энергии должен быть между 0 и 100");
  
  Capital::global_state_table global_state_inst(_self, _self.value);
  auto itr = global_state_inst.find(coopname.value);

  // CDT binary_extension::operator<< всегда пишет value_or() — для пустого
  // поля это T() = asset() с пустым символом. Поэтому program_expense_* нельзя
  // оставлять «не заданными»: при первой же записи state они материализуются
  // как «0 » без RUB и ломают topup/reserve (attempt to add asset with different symbol).
  const asset zero_rub = asset(0, _root_govern_symbol);

  if (itr == global_state_inst.end()) {
    global_state_inst.emplace(coopname, [&](auto& s) {
      s.coopname = coopname;
      s.config = config;
      s.program_expense_pool = zero_rub;
      s.program_expense_reserved = zero_rub;
    });
  } else {
    global_state_inst.modify(itr, coopname, [&](auto& s) {
      s.config = config;
      // Лечим уже записанные битые нули с пустым символом (после reboot/старых деплоев).
      s.program_expense_pool =
          Capital::State::ext_or_zero(s.program_expense_pool, _root_govern_symbol);
      s.program_expense_reserved =
          Capital::State::ext_or_zero(s.program_expense_reserved, _root_govern_symbol);
    });
  }
}


