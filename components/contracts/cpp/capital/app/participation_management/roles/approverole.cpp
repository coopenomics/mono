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
 * Решение принимает мастер компонента: его имя приходит параметром @p master и
 * сверяется с реестром проекта. Без этой сверки любой пайщик утвердил бы себе
 * ставку часа, а от неё считается стоимость коммита. Исключение — заявка на роль
 * мастера: мастера в проекте может ещё не быть, такое решение принимает
 * председатель, и право на него проверяется на стороне кооператива.
 *
 * @param coopname        Кооператив
 * @param request_hash    Хеш заявки (requestrole либо requestrateu)
 * @param master          Тот, кто принимает решение — мастер компонента
 * @param approved_rate   Утверждённая мастером ставка часа (≠ запрошенной — допустимо)
 * @param approved_hours  Утверждённая норма часов
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::approverole(name coopname, checksum256 request_hash, name master,
                          eosio::asset approved_rate, uint64_t approved_hours) {
  require_auth(coopname);

  Wallet::validate_asset(approved_rate);
  eosio::check(approved_rate.amount > 0, "Утверждённая ставка должна быть положительной");
  eosio::check(approved_hours > 0 && approved_hours <= 8, "Норма часов — от 1 до 8");

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  Capital::RoleRequests::check_decider_or_fail(coopname, req, master);

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

  // Заявитель и мастер компонента получают уведомление о решении.
  require_recipient(req.username);
  require_recipient(req.master);
}
