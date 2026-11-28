/**
 * @brief Назначение оператора сети.
 *
 * Оператор — кооператив, которому ведущий доверил подключать другие
 * кооперативы и обслуживать их. Операторов в сети может быть несколько;
 * ведущий назначает оператором и себя. Только кооператив из этого списка
 * `setoperator` записывает оператором другого кооператива.
 *
 * Повторное назначение ничего не меняет: загрузка цепи и миграция вызывают
 * действие без проверки, назначен ли оператор раньше.
 *
 * @param operator_name Кооператив, который становится оператором
 * @ingroup public_actions
 * @ingroup public_registrator_actions
 *
 * @note Авторизация требуется от аккаунта: ведущий сети
 */
[[eosio::action]] void registrator::appoint(eosio::name operator_name)
{
  require_auth(network_lead());

  // Оператор — действующий кооператив реестра: обслуживать чужие подключения,
  // не действуя самому, значит обещать то, чего не выполнишь.
  cooperatives2_index coops(_registrator, _registrator.value);
  auto oper = coops.find(operator_name.value);
  eosio::check(oper != coops.end(), "REGISTRATOR_OPERATOR_NOT_FOUND: Оператор не найден в реестре кооперативов");
  eosio::check(oper->is_cooperative, "REGISTRATOR_OPERATOR_NOT_COOPERATIVE: Оператором назначается только кооператив");
  eosio::check(oper->status.has_value() && oper->status.value() == "active"_n,
               "REGISTRATOR_OPERATOR_INACTIVE: Оператором назначается только действующий кооператив");

  Registrator::operators_index operators(_registrator, _registrator.value);
  if (operators.find(operator_name.value) != operators.end())
    return;

  operators.emplace(RamPayer::of(operators), [&](auto &row) {
    row.username = operator_name;
    row.appointed_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });
}
