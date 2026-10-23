/**
 * @brief Кандидат принимает инвайт от мастера: ставка/часы из заявки становятся
 *        approved-параметрами сегмента.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш инвайт-заявки
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p coopname (backend подставляет кандидата).
 */
void capital::acceptinvite(name coopname, checksum256 request_hash) {
  require_auth(coopname);

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  eosio::check(req.direction == Capital::RoleRequests::Direction::INVITE,
               "Принять можно только инвайт");

  Capital::RoleRequests::approve(coopname, req.id, req.rate_per_hour, req.hours_per_day);
  Capital::Segments::set_approved_rate(
    coopname, req.project_hash, req.username, req.rate_per_hour, req.hours_per_day
  );

  // Подключаем кандидата к проекту по приглашённой роли.
  if (req.request_type == Capital::RoleRequests::RequestType::ROLE) {
    Capital::RoleRequests::apply_role_to_project(
      coopname, req.project_hash, req.username, req.role
    );
  }

  // event ridge: кандидат и мастер видят принятие инвайта.
  require_recipient(req.username);
  require_recipient(req.master);
}
