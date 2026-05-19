using namespace Loan;

/**
 * @brief Создание долгового обязательства.
 * Создает новое долговое обязательство для пользователя с указанным сроком погашения
 * и привязкой к проекту вызывающего контракта.
 * @param coopname Наименование кооператива
 * @param username Имя пользователя-должника
 * @param project_hash Хэш проекта/программы (для лимита займов на проект при паевом взносе)
 * @param debt_hash Хэш долгового обязательства
 * @param repaid_at Срок погашения долга
 * @param quantity Сумма долга
 * @ingroup public_actions
 * @ingroup public_loan_actions

 * @note Авторизация требуется от аккаунта: @p contracts_whitelist
 */
void loan::createdebt(name coopname, name username, checksum256 project_hash, checksum256 debt_hash, time_point_sec repaid_at, asset quantity) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);

  check(quantity.amount > 0, "Сумма должна быть положительной");
  check(repaid_at > time_point_sec(current_time_point()), "Дата погашения должна быть в будущем");

  auto exist = get_debt(coopname, debt_hash);
  check(!exist.has_value(), "Долг с таким хэшем уже существует");

  Loan::debts_index debts(_loan, coopname.value);
  uint64_t new_id = get_global_id_in_scope(_loan, coopname, "debts"_n);

  debts.emplace(_loan, [&](auto& d) {
    d.id = new_id;
    d.coopname = coopname;
    d.username = username;
    d.debt_hash = debt_hash;
    d.amount = quantity;
    d.created_at = time_point_sec(current_time_point());
    d.repaid_at = repaid_at;
    d.project_hash.emplace(project_hash);
  });

  Loan::summaries_index summaries(_loan, coopname.value);
  auto sum_itr = summaries.find(username.value);
  if (sum_itr == summaries.end()) {
    summaries.emplace(_loan, [&](auto& s) {
      s.username = username;
      s.total = quantity;
    });
  } else {
    summaries.modify(sum_itr, same_payer, [&](auto& s) {
      s.total += quantity;
    });
  }
}
