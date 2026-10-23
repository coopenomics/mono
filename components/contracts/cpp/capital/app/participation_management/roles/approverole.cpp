/**
 * @brief Мастер компонента одобряет заявку на L2-допуск либо обновление approved-ставки.
 *
 * Фиксирует approved-ставку и норматив часов в сегменте через
 * @ref Capital::Segments::set_approved_rate — далее `createcmmt` берёт их.
 * Сегмент должен уже существовать (создаётся при подписании приложения договора УХД
 * на этот проект через apprvappndx — L1-допуск).
 *
 * Бездокументарная схема: решение фиксируется только подписью транзакции
 * (require_auth coopname), документ-решение мастера не передаётся.
 *
 * @param coopname        Кооператив
 * @param request_hash    Хеш заявки (requestrole либо requestrateu)
 * @param approved_rate   Утверждённая мастером ставка часа (≠ запрошенной — допустимо)
 * @param approved_hours  Утверждённая норма часов
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::approverole(name coopname, checksum256 request_hash,
                          eosio::asset approved_rate, uint64_t approved_hours) {
  require_auth(coopname);

  Wallet::validate_asset(approved_rate);
  eosio::check(approved_rate.amount > 0, "Утверждённая ставка должна быть положительной");
  eosio::check(approved_hours > 0 && approved_hours <= 8, "Норма часов — от 1 до 8");

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);

  Capital::RoleRequests::approve(coopname, req.id, approved_rate, approved_hours);

  Capital::Segments::set_approved_rate(
    coopname, req.project_hash, req.username, approved_rate, approved_hours
  );

  // Только для ROLE-заявок: подключаем участника к проекту по заявленной роли.
  // RATE_UPDATE роль не меняет, только ставку — inline action не нужен.
  if (req.request_type == Capital::RoleRequests::RequestType::ROLE) {
    Capital::RoleRequests::apply_role_to_project(
      coopname, req.project_hash, req.username, req.role
    );
  }

  // event ridge: заявитель и мастер компонента видят решение.
  require_recipient(req.username);
  require_recipient(req.master);
}
