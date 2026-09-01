/**
 * @brief Заявка пайщика на обновление approved-ставки на сегменте.
 *        Тот же flow что и requestrole, но через RequestType::RATE_UPDATE.
 *        approverole с новой ставкой → обновление сегмента; declinerole — без изменений.
 *
 * Бездокументарная схема: заявление-документ не передаётся, утверждение
 * фиксируется только транзакцией. role в записи остаётся Role::NONE
 * (валидация роли для RATE_UPDATE не применяется).
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш заявки
 * @param project_hash Проект / компонент
 * @param username     Заявитель
 * @param master       Мастер компонента (ожидаемый одобряющий)
 * @param new_rate     Желаемая новая ставка
 * @param new_hours    Желаемая новая норма часов
 * @param description  Текст заявки на обновление ставки (может быть пустым)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::requestrateu(name coopname, checksum256 request_hash, checksum256 project_hash,
                           name username, name master,
                           eosio::asset new_rate, uint64_t new_hours,
                           std::string description) {
  require_auth(coopname);

  Wallet::validate_asset(new_rate);
  eosio::check(new_rate.amount > 0, "Новая ставка должна быть положительной");
  eosio::check(new_hours > 0 && new_hours <= 8, "Норма часов — от 1 до 8");

  Capital::RoleRequests::create(
    coopname, request_hash, project_hash, username, master,
    Capital::RoleRequests::Role::NONE,
    new_rate, new_hours,
    Capital::RoleRequests::Direction::REQUEST,
    Capital::RoleRequests::RequestType::RATE_UPDATE,
    description
  );

  // event ridge: заявитель и мастер компонента видят запрос на обновление ставки.
  require_recipient(username);
  require_recipient(master);
}
