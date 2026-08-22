#include "registration_migration.hpp"

/**
 * @brief Отклонение регистрации пользователя.
 * Отклоняет регистрацию кандидата советом
 * @param coopname Наименование кооператива
 * @param registration_hash Хэш регистрации
 * @param reason Причина отклонения регистрации
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void registrator::declinereg(name coopname, checksum256 registration_hash, std::string reason) {
  require_auth(_soviet);

  auto candidate = Registrator::get_candidate_by_hash(coopname, registration_hash);
  eosio::check(candidate.has_value(), "Кандидат не найден");

  // оповещаем кандидата об отказе совета
  require_recipient(candidate -> username);

  // Совет отказал — процесс приёма взноса прерывается, начинается процесс
  // возврата (p.reg.refund). Деньги НЕ списываем здесь: они стоят на расчётах
  // с пайщиком (счёт 76, кошелёк w.reg.pend) до тех пор, пока касса фактически
  // не проведёт исходящий возврат. Обратную проводку Дт 76 / Кт 51 выполняет
  // коллбэк refundpay по подтверждению кассы (gateway::outcomplete) — симметрично
  // возврату паевого в контракте 'wallet' (authwthd → createoutpay → completewthd).
  //
  // MIGRATION (снять условие после 30.07.2026, см. registration_migration.hpp):
  // кандидаты, принятые ДО релиза двухфазного учёта, суспенса на w.reg.pend
  // не имеют — для них on-chain возврата нет (как было раньше), банковский
  // возврат оформляет бэкенд, а запись кандидата закрываем сразу.
  eosio::asset pending = Registrator::get_registration_pending_balance(coopname, candidate -> username);

  Registrator::candidates_index candidates(_registrator, coopname.value);
  auto it = candidates.find(candidate -> username.value);

  if (pending.amount > 0) {
    // Новый путь: переводим кандидата в возврат и создаём исходящий платёж в
    // gateway с коллбэком после подтверждения кассой. Деньги остаются на счёте 76
    // вплоть до фактического проведения возврата кассой (refundpay).
    candidates.modify(it, _registrator, [&](auto &c){
      c.status = "refunding"_n;
    });

    action(permission_level{ _registrator, "active"_n}, _gateway, "createoutpay"_n,
      std::make_tuple(
        coopname,
        candidate -> username,
        registration_hash,
        pending,
        _registrator,
        "refundpay"_n,
        "declinerfnd"_n
      )
    ).send();
  } else {
    // Миграционный путь: возвращать на цепи нечего — закрываем кандидата и
    // освобождаем аккаунт для повторной подачи (снимаем карточку участника).
    if (it != candidates.end()) candidates.erase(it);
    reset_account_card(candidate -> username);
  }
}
