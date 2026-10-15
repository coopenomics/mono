/**
 * @brief Восстановление решения в таблице decisions
 * Создает решение с заданными параметрами если его не существует
 * @param coopname Имя кооператива
 * @param decision_id ID решения
 * @param username Имя пользователя
 * @param type Тип решения
 * @param batch_id ID партии
 * @param statement Документ заявления
 * @param votes_for Голоса за
 * @param votes_against Голоса против
 * @param validated Флаг валидации
 * @param approved Флаг одобрения
 * @param authorized Флаг авторизации
 * @param authorized_by Кто авторизовал
 * @param authorization Документ авторизации
 * @param created_at Время создания
 * @param expired_at Время истечения
 * @param meta Мета-данные
 * @param callback_contract Контракт обратного вызова
 * @param confirm_callback Действие подтверждения
 * @param decline_callback Действие отклонения
 * @param hash Хэш решения
 * @ingroup public_actions
 * @ingroup public_soviet_actions
 *
 * @note Авторизация требуется от аккаунта: @p _soviet
 */
[[eosio::action]] void soviet::repairdec(
  eosio::name coopname,
  uint64_t decision_id,
  eosio::name username,
  eosio::name type,
  uint64_t batch_id,
  document2 statement,
  std::vector<eosio::name> votes_for,
  std::vector<eosio::name> votes_against,
  bool validated,
  bool approved,
  bool authorized,
  eosio::name authorized_by,
  document2 authorization,
  eosio::time_point_sec created_at,
  eosio::time_point_sec expired_at,
  std::string meta,
  eosio::name callback_contract,
  eosio::name confirm_callback,
  eosio::name decline_callback,
  checksum256 hash
) {
  require_auth(_soviet);

  decisions_index decisions(_soviet, coopname.value);

  // Проверяем, существует ли уже решение с таким ID
  auto decision_it = decisions.find(decision_id);

  if (decision_it == decisions.end()) {
    decisions.emplace(RamPayer::of(decisions, coopname), [&](auto &d){
      d.id = decision_id;
      d.coopname = coopname;
      d.username = username;
      d.type = type;
      d.batch_id = batch_id;
      d.statement = statement;
      d.votes_for = votes_for;
      d.votes_against = votes_against;
      d.validated = validated;
      d.approved = approved;
      d.authorized = authorized;
      d.authorized_by = authorized_by;
      d.authorization = authorization;
      d.created_at = created_at;
      d.expired_at = expired_at;
      d.meta = meta;
      d.callback_contract = callback_contract;
      d.confirm_callback = confirm_callback;
      d.decline_callback = decline_callback;
      d.hash = hash;
    });
  }
}
