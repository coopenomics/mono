/**
 * @brief Мастер компонента отклоняет заявку на L2-допуск / на обновление approved-ставки.
 *        Запись остаётся в таблице со статусом DECLINED + причиной — для аудита.
 *
 * Решение принимает мастер компонента — его имя сверяется с реестром проекта
 * (см. approverole). Отказ по заявке на роль мастера принимает председатель.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш заявки
 * @param master       Тот, кто принимает решение — мастер компонента
 * @param reason       Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::declinerole(name coopname, checksum256 request_hash, name master, std::string reason) {
  require_auth(coopname);

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  Capital::RoleRequests::check_decider_or_fail(coopname, req, master);
  Capital::RoleRequests::decline(coopname, req.id, reason);

  // Заявитель и мастер компонента получают уведомление об отказе.
  require_recipient(req.username);
  require_recipient(req.master);
}
