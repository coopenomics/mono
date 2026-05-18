/**
 * @brief Заявка пайщика на обновление approved-ставки на сегменте.
 *        Тот же flow что и requestrole, но RequestType::RATE_UPDATE.
 *        approverole с новой ставкой → обновление сегмента; declinerole — без изменений.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш заявки
 * @param project_hash Проект / компонент
 * @param username     Заявитель
 * @param master       Мастер компонента (ожидаемый одобряющий)
 * @param new_rate     Желаемая новая ставка
 * @param new_hours    Желаемая новая норма часов
 * @param statement    Заявление (RateUpdateStatement — Эпик 3)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::requestrateu(name coopname, checksum256 request_hash, checksum256 project_hash,
                           name username, name master,
                           eosio::asset new_rate, uint64_t new_hours,
                           document2 statement) {
  require_auth(coopname);

  verify_document_or_fail(statement);
  Wallet::validate_asset(new_rate);
  eosio::check(new_rate.amount > 0, "Новая ставка должна быть положительной");
  eosio::check(new_hours > 0 && new_hours <= 12, "Норма часов — от 1 до 12");

  // role не значим для RATE_UPDATE — кладём "rate"_n как маркер.
  Capital::RoleRequests::create(
    coopname, request_hash, project_hash, username, master, "rate"_n,
    new_rate, new_hours,
    Capital::RoleRequests::Direction::REQUEST,
    Capital::RoleRequests::RequestType::RATE_UPDATE,
    statement
  );

  // event ridge: заявитель и мастер компонента видят запрос на обновление ставки.
  require_recipient(username);
  require_recipient(master);
}
