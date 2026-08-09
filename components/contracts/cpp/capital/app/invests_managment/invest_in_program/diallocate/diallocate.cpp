/**
 * @brief Возвращает аллоцированные программные средства из проекта в глобальный пул программы
 *
 * Обратная операция к @ref capital::allocate. Кооператив может передумать и
 * забрать из проекта ранее аллоцированные средства — целиком или частично,
 * не дожидаясь завершения проекта.
 *
 * Что делает:
 *  - проверяет, что проект в статусе pending или active (после начала
 *    голосования суммы уже участвуют в расчёте результата, двигать их нельзя);
 *  - пересчитывает сумму непогашенных ссуд проекта обходом сегментов;
 *  - считает предельно допустимую сумму возврата (calculate_max_deallocatable);
 *  - уменьшает пулы проекта и пересчитывает коэффициент возврата;
 *  - зачисляет сумму обратно в глобальный пул программы.
 *
 * Историческая справка: до этой версии action требовал статус pending и
 * возвращал средства только при use_invest_percent > 100. Такое значение
 * недостижимо — обе функции расчёта коэффициента жёстко ограничивают его
 * сотней (`coefficient_percent > 100.0 ? 100.0 : coefficient_percent`).
 * Действие проходило проверки и молча не возвращало ничего.
 *
 * @note После деаллокации сегменты всех участников проекта становятся
 * неактуальными (last_known_invest_pool разошёлся с fact.invest_pool) — им
 * потребуется rfrshsegment, как и после обычной аллокации. Предельная сумма
 * подобрана так, чтобы это обновление ни у кого не упало на инварианте
 * provisional_amount >= debt_amount.
 *
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта для деаллокации
 * @param amount Сумма для возврата в глобальный пул программы
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::diallocate(eosio::name coopname, checksum256 project_hash, eosio::asset amount) {
  require_auth(coopname);

  Wallet::validate_asset(amount);

  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  eosio::check(project.status == Capital::Projects::Status::PENDING ||
                   project.status == Capital::Projects::Status::ACTIVE,
               "Деаллокация доступна только в статусе 'pending' или 'active'");

  // Сумма непогашенных ссуд — производная от сегментов, синхронизируем перед расчётом границы
  Capital::Projects::sync_total_debt(coopname, project.id);

  // Читаем проект заново: sync_total_debt изменил строку
  auto actual_project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  eosio::asset max_amount = Capital::Projects::calculate_max_deallocatable(coopname, actual_project);

  eosio::check(max_amount.amount > 0, "В проекте нет средств, доступных к возврату");
  eosio::check(amount <= max_amount,
               "Сумма возврата превышает доступную. Доступно к возврату: " + max_amount.to_string());

  Capital::Core::deallocate_program_investment_from_project(coopname, actual_project.id, amount);
}
