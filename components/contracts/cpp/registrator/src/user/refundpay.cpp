#include "registration_migration.hpp"

/**
 * @brief Подтверждение возврата регистрационного взноса.
 * Коллбэк gateway после фактического проведения кассой исходящего возврата
 * (gateway::outcomplete). Проводит обратную проводку Дт 76 / Кт 51 (сжигание
 * суспенса w.reg.pend) и закрывает запись кандидата. Деньги уходят со счёта 76
 * ровно в этот момент — не раньше, чем касса подтвердит исходящий перевод.
 * @param coopname Наименование кооператива
 * @param registration_hash Хэш регистрации (= outcome_hash исходящего платежа)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p gateway
 */
void registrator::refundpay(name coopname, checksum256 registration_hash) {
  require_auth(_gateway);

  auto candidate = Registrator::get_candidate_by_hash(coopname, registration_hash);
  eosio::check(candidate.has_value(), "Кандидат не найден");
  eosio::check(candidate -> status == "refunding"_n, "Кандидат не находится в процессе возврата");

  // оповещаем кандидата о завершении возврата
  require_recipient(candidate -> username);

  // Сжигаем фактический остаток на w.reg.pend — он равен полученной сумме
  // (вступительный + минимальный паевой). Обратная проводка Дт 76 / Кт 51.
  eosio::asset pending = Registrator::get_registration_pending_balance(coopname, candidate -> username);
  eosio::check(pending.amount > 0, "Нет средств на возврат");

  std::string memo = "Возврат регистрационного взноса при отказе совета, username=" + candidate -> username.to_string();
  Ledger2::apply(_registrator, coopname, operations::registrator::REFUND, pending, candidate -> username, registration_hash, memo);

  // Возврат завершён — удаляем кандидата из картотеки.
  Registrator::candidates_index candidates(_registrator, coopname.value);
  auto it = candidates.find(candidate -> username.value);
  candidates.erase(it);

  // Освобождаем аккаунт для повторной подачи на том же username: снимаем
  // карточку участника, иначе reguser упадёт «повторное получение невозможно».
  reset_account_card(candidate -> username);
}
