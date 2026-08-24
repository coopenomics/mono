/**
 * @brief Заявка пайщика на L2-допуск (роль creator/author/master) на компоненте.
 *
 * Создаёт запись в `rolerequests` со статусом PENDING. Дальше мастер компонента
 * (или председатель — для роли master, когда мастера в проекте ещё нет)
 * решает: approverole (с фиксацией approved-ставки в сегменте) или declinerole.
 *
 * Бездокументарная схема: подача и решение оформляются только подписью транзакции
 * (require_auth coopname). Юридическое заявление при приёме на роль не требуется —
 * допуск даётся подписью действия на стороне кооператива.
 *
 * Ставка часа подаётся явно — это ставка пайщика именно под этот проект.
 * По дефолту фронт подставляет contributors.rate_per_hour, но пайщик может изменить.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш заявки (анкер для approverole/declinerole)
 * @param project_hash Проект (или компонент — на уровне хэша одно)
 * @param username     Заявитель
 * @param master       Мастер компонента (ожидаемый одобряющий)
 * @param role         Запрашиваемая роль: Role::CREATOR | Role::AUTHOR | Role::MASTER
 * @param rate_per_hour Заявленная ставка часа под этот проект
 * @param hours_per_day Заявленная норма часов в день
 * @param description  Текст заявки (может быть пустым)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::requestrole(name coopname, checksum256 request_hash, checksum256 project_hash,
                          name username, name master, name role,
                          eosio::asset rate_per_hour, uint64_t hours_per_day,
                          std::string description) {
  require_auth(coopname);

  Capital::RoleRequests::validate_role_or_fail(role);
  Capital::RoleRequests::check_master_or_fail(coopname, project_hash, master, role);
  Wallet::validate_asset(rate_per_hour);
  eosio::check(rate_per_hour.amount > 0, "Ставка часа должна быть положительной");
  eosio::check(hours_per_day > 0 && hours_per_day <= 8, "Норма часов в день — от 1 до 8");

  Capital::RoleRequests::create(
    coopname, request_hash, project_hash, username, master, role,
    rate_per_hour, hours_per_day,
    Capital::RoleRequests::Direction::REQUEST,
    Capital::RoleRequests::RequestType::ROLE,
    description
  );

  // Заявитель и мастер компонента получают уведомление о новой заявке.
  require_recipient(username);
  require_recipient(master);
}
