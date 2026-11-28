/**
 * @brief Снятие оператора сети.
 *
 * Кооператив перестаёт быть оператором: новые кооперативы он не подключает.
 * Кооперативы, которые он подключил раньше, запись об операторе сохраняют —
 * сменить оператора они вправе действием `setoperator`, перейти на свою
 * платформу — действием `deloperator`.
 *
 * @param operator_name Кооператив, с которого снимается роль оператора
 * @ingroup public_actions
 * @ingroup public_registrator_actions
 *
 * @note Авторизация требуется от аккаунта: ведущий сети
 */
[[eosio::action]] void registrator::dismiss(eosio::name operator_name)
{
  require_auth(network_lead());

  Registrator::operators_index operators(_registrator, _registrator.value);
  auto row = operators.find(operator_name.value);
  eosio::check(row != operators.end(), "REGISTRATOR_OPERATOR_NOT_APPOINTED: Кооператив не назначен оператором сети");
  operators.erase(row);
}
