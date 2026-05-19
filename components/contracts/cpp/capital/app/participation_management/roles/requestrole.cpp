/**
 * @brief Заявка пайщика на L2-допуск (роль creator/author/contributor) на компоненте.
 *
 * Создаёт запись в `rolerequests` со статусом PENDING. Дальше мастер компонента
 * решает: approverole (с фиксацией approved-ставки в сегменте) или declinerole.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш заявки (анкер для approverole/declinerole)
 * @param project_hash Проект (или компонент — на уровне хэша одно)
 * @param username     Заявитель
 * @param master       Мастер компонента (ожидаемый одобряющий; информационно)
 * @param role         Запрашиваемая роль: creator | author | contributor | ...
 * @param rate_per_hour Желаемая ставка часа
 * @param hours_per_day Желаемая норма часов
 * @param statement    Заявление (документ RoleRequestStatement — Эпик 3)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::requestrole(name coopname, checksum256 request_hash, checksum256 project_hash,
                          name username, name master, name role,
                          eosio::asset rate_per_hour, uint64_t hours_per_day,
                          document2 statement) {
  require_auth(coopname);

  verify_document_or_fail(statement);
  Wallet::validate_asset(rate_per_hour);
  eosio::check(rate_per_hour.amount > 0, "Ставка часа должна быть положительной");
  eosio::check(hours_per_day > 0 && hours_per_day <= 8, "Норма часов в день — от 1 до 8");

  Capital::RoleRequests::create(
    coopname, request_hash, project_hash, username, master, role,
    rate_per_hour, hours_per_day,
    Capital::RoleRequests::Direction::REQUEST,
    Capital::RoleRequests::RequestType::ROLE,
    statement
  );

  // event ridge: заявитель и мастер компонента видят новую заявку.
  require_recipient(username);
  require_recipient(master);
}
