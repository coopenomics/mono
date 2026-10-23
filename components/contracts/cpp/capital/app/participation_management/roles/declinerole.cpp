/**
 * @brief Мастер компонента отклоняет заявку на L2-допуск / на обновление approved-ставки.
 *        Запись остаётся в таблице со статусом DECLINED + причиной — для аудита.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш заявки
 * @param reason       Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::declinerole(name coopname, checksum256 request_hash, std::string reason) {
  require_auth(coopname);

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  Capital::RoleRequests::decline(coopname, req.id, reason);

  // event ridge: заявитель и мастер компонента видят отказ.
  require_recipient(req.username);
  require_recipient(req.master);
}
