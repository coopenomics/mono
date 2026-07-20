#include "registration_migration.hpp"

/**
 * @brief Подтверждение регистрации пользователя.
 * Подтверждает регистрацию кандидата советом и добавляет его в кооператив
 * @param coopname Наименование кооператива
 * @param registration_hash Хэш регистрации
 * @param authorization Документ авторизации от совета
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void registrator::confirmreg(eosio::name coopname, checksum256 registration_hash, document2 authorization)
{
  require_auth(_soviet);
  
  auto candidate = Registrator::get_candidate_by_hash(coopname, registration_hash);
  eosio::check(candidate.has_value(), "Кандидат не найден");
  
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(candidate -> username.value);
  
  //оповещаем пользователя
  require_recipient(candidate -> username);
  
  accounts.modify(account, _registrator, [&](auto &acc){
    acc.status = "active"_n;
  });
  
  eosio::time_point_sec now = current_time_point();
  
  //создаём объект пайщика
  action(
    permission_level{_registrator, "active"_n}, 
    _soviet, 
    "addpartcpnt"_n,
    std::make_tuple(
      coopname, 
      candidate -> username, 
      candidate -> braname,
      account -> type, 
      now, 
      candidate -> initial, 
      candidate -> minimum, 
      true
    )
  ).send();

  // Совет одобрил — признаём взнос. Гарды amount>0: у кооператива может не быть
  // вступительного (initial==0) — ledger2::apply падает на нулевой сумме.
  //
  // MIGRATION (снять условие после 30.07.2026, см. registration_migration.hpp):
  // для кандидатов, принятых ДО релиза двухфазного учёта (нет баланса на
  // w.reg.pend), признаём по старому пути — прямой ISSUE (Dr 51 / Cr 80|86);
  // для новых — переносим суспенс с 76 на 80/86 (TRANSFER w.reg.pend → ...).
  bool has_pending = Registrator::get_registration_pending_balance(coopname, candidate -> username).amount > 0;

  if (candidate -> minimum.amount > 0) {
    std::string memo = "Зачисление минимального паевого взноса по решению совета, username=" + candidate -> username.to_string();
    Ledger2::apply(_registrator, coopname,
      has_pending ? operations::registrator::SETTLE_MINSHARE : operations::registrator::PUT_MINSHARE,
      candidate -> minimum, candidate -> username, registration_hash, memo);
  }

  if (candidate -> initial.amount > 0) {
    std::string memo = "Зачисление вступительного взноса по решению совета, username=" + candidate -> username.to_string();
    Ledger2::apply(_registrator, coopname,
      has_pending ? operations::registrator::SETTLE_ENTRANCE : operations::registrator::PAY_ENTRANCE,
      candidate -> initial, candidate -> username, registration_hash, memo);
  }
  // Увеличиваем счетчик активных пайщиков
  cooperatives2_index cooperatives(_registrator, _registrator.value);
  auto coop_itr = cooperatives.find(coopname.value);
  
  if (coop_itr != cooperatives.end() && coop_itr->is_cooperative) {
    cooperatives.modify(coop_itr, _registrator, [&](auto &coop) {
      if (coop.active_participants_count.has_value()) {
        coop.active_participants_count = coop.active_participants_count.value() + 1;
      } else {
        coop.active_participants_count = 1;
      }
    });
  }
  
  Registrator::candidates_index candidates(_registrator, coopname.value);
  auto it = candidates.find(candidate -> username.value);
  candidates.erase(it);
}
