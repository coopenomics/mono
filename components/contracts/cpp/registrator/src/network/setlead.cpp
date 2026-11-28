/**
 * @brief Запись ведущего сети.
 *
 * Ведущий — кооператив, который запустил цепь и ведёт сеть: он назначает
 * операторов и регистрирует кооперативы. Имя ведущего хранит строка `network`;
 * пока строки нет, ведущим считается имя по умолчанию (`_default_lead`).
 *
 * Своя сеть называет ведущего этим действием один раз при запуске цепи, до
 * `init`: `init` заводит запись ведущего в реестре под действующим именем.
 * Действие меняет управляющего всей сетью, поэтому подписывает его только
 * системный аккаунт цепи.
 *
 * @param lead Аккаунт ведущего сети
 * @ingroup public_actions
 * @ingroup public_registrator_actions
 *
 * @note Авторизация требуется от аккаунта: @p system
 */
[[eosio::action]] void registrator::setlead(eosio::name lead)
{
  require_auth(_system);

  eosio::check(eosio::is_account(lead), "REGISTRATOR_LEAD_ACCOUNT_NOT_FOUND: Аккаунт ведущего сети не найден");

  Registrator::network_singleton state(_registrator, _registrator.value);
  state.set(Registrator::network_state{lead}, _registrator);
}
