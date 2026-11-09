/**
 * @brief Увеличение счетчика активных пайщиков.
 * Возвращает пайщика в счётчик активных пайщиков кооператива, когда совет
 * снимает с него блокировку и возвращает право голоса. Зеркало `decparticpnt`:
 * блокировка вычитает пайщика из счётчика, разблокировка возвращает обратно.
 * Без этой пары счётчик после каждой блокировки с разблокировкой оставался
 * на единицу меньше числа пайщиков с правом голоса, и кворум общего собрания
 * считался от заниженного числа (09.11.2026: у ВОСХОДа счётчик 45 при 46).
 * @param coopname Имя кооператива
 * @param username Имя пайщика
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void registrator::incparticpnt(eosio::name coopname, eosio::name username)
{
  require_auth(_soviet);

  cooperatives2_index cooperatives(_registrator, _registrator.value);
  auto coop_itr = cooperatives.find(coopname.value);

  // Кооператив без счётчика не заводим здесь заново: счётчик появляется при
  // первом приёме пайщика (confirmreg/adduser) и выправляется пересчётом в migrate.
  if (coop_itr == cooperatives.end() || !coop_itr->is_cooperative || !coop_itr->active_participants_count.has_value())
    return;

  cooperatives.modify(coop_itr, RamPayer::of(cooperatives, coopname), [&](auto &coop) {
    coop.active_participants_count = coop.active_participants_count.value() + 1;
  });
}
