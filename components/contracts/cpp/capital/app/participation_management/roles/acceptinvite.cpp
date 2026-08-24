/**
 * @brief Кандидат принимает инвайт от мастера: ставка/часы из заявки становятся
 *        approved-параметрами сегмента.
 *
 * Принять приглашение может только тот пайщик, которому оно адресовано:
 * его имя приходит параметром @p username и сверяется с приглашением.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш инвайт-заявки
 * @param username     Приглашённый пайщик, который принимает приглашение
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p coopname (backend подставляет кандидата).
 */
void capital::acceptinvite(name coopname, checksum256 request_hash, name username) {
  require_auth(coopname);

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  eosio::check(req.direction == Capital::RoleRequests::Direction::INVITE,
               "Принять можно только приглашение");
  eosio::check(req.username == username,
               "Принять приглашение может только тот, кому оно адресовано");

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

  // Приглашённый и мастер компонента получают уведомление о принятии.
  require_recipient(req.username);
  require_recipient(req.master);
}
