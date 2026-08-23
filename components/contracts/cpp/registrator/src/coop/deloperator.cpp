/**
 * @brief Снятие оператора с кооператива.
 *
 * Обслуживание прекращается: кооператив снова считается держащим установку сам.
 * Пустой оператор и означает собственную установку — того же вида запись, что у
 * кооператива, который никому её не поручал.
 *
 * Выданное заверение это действие не отзывает и отозвать не может: подпись уже у
 * того, кому её выдали. Но продлевать её будет некому, и она погаснет сама в
 * пределах своего срока — месяца или меньше.
 *
 * Снять оператора может любая из двух сторон: кооператив вправе уйти, оператор
 * вправе перестать обслуживать. Держать кого-то в обслуживании против воли
 * незачем — обязательство одностороннее, и принуждать к нему нечем.
 *
 * @param coopname Кооператив, с которого снимается оператор
 * @ingroup public_actions
 * @ingroup public_registrator_actions
 *
 * @note Авторизация: @p coopname, его нынешний оператор либо провайдер.
 */
[[eosio::action]] void registrator::deloperator(eosio::name coopname)
{
  cooperatives2_index coops(_registrator, _registrator.value);

  auto coop = coops.find(coopname.value);
  eosio::check(coop != coops.end(), "Кооператив не найден");

  const eosio::name current = coop->parent_username;
  eosio::check(current != eosio::name(), "У кооператива и так нет оператора");

  eosio::check(has_auth(coopname) || has_auth(current) || has_auth(_provider),
               "Снять оператора может сам кооператив, его оператор либо провайдер");

  coops.modify(coop, eosio::same_payer, [&](auto &row) {
    row.parent_username = eosio::name();
  });
}
