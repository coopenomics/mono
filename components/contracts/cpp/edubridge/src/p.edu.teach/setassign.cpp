/**
 * @brief Допуск преподавателя к курсу и его ставка на этом курсе.
 *
 * Ставка — за час на одного участника. Администратор задаёт её при допуске и
 * меняет по ходу курса: новая ставка действует на занятия, открытые после
 * правки. Ставка не выше плановой ставки курса — оплата занятия заложена во
 * взнос участника по плановой.
 *
 * Движений средств нет.
 *
 * Guards:
 *  - у преподавателя действующий договор участия в хозяйственной деятельности;
 *  - условия курса заданы;
 *  - ставка > 0 и не выше плановой ставки курса;
 *  - допуск с этим номером принадлежит тому же преподавателю и курсу.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::setassign(eosio::name coopname,
                          uint64_t assignment_id,
                          eosio::name username,
                          uint64_t course_id,
                          eosio::asset rate) {
  require_auth(coopname);

  Edubridge::check_money(rate, "Ставка преподавателя");
  Edubridge::get_active_contract_or_fail(coopname, username);
  const edu_terms terms = Edubridge::get_terms_or_fail(coopname, course_id);
  eosio::check(rate <= terms.planned_rate,
               std::string{"Ставка преподавателя выше плановой ставки курса: плановая "} +
                 terms.planned_rate.to_string());

  edu_assignments_index assigns(_edubridge, coopname.value);
  auto it = assigns.find(assignment_id);
  if (it == assigns.end()) {
    assigns.emplace(RamPayer::of(assigns, coopname), [&](auto& a) {
      a.assignment_id = assignment_id;
      a.username      = username;
      a.course_id     = course_id;
      a.rate          = rate;
    });
  } else {
    eosio::check(it->username == username && it->course_id == course_id,
                 "Допуск с этим номером выдан другому преподавателю либо на другой курс");
    assigns.modify(it, RamPayer::of(assigns, coopname), [&](auto& a) { a.rate = rate; });
  }
}

/**
 * @brief Снятие допуска преподавателя к курсу.
 *
 * Запись стирается: новых занятий по этому допуску преподаватель не откроет.
 * Занятие, по которому уже идёт расчёт, доводится до конца — его ставка
 * зафиксирована в записи занятия. Движений средств нет.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::delassign(eosio::name coopname,
                          uint64_t assignment_id) {
  require_auth(coopname);

  edu_assignments_index assigns(_edubridge, coopname.value);
  auto it = assigns.find(assignment_id);
  eosio::check(it != assigns.end(), "Допуск с указанным номером не найден");
  assigns.erase(it);
}
