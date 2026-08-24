/**
 * @brief Создает коммит в проект
 * Создает коммит с затраченным временем создателя и отправляет на одобрение:
 * - Проверяет существование проекта и его активный статус
 * - Валидирует активность основного договора УХД
 * - Проверяет наличие приложения к проекту
 * - Валидирует уникальность коммита по хешу
 * - Проверяет положительность часов создателя
 * - Проверяет, что у участника задана положительная стоимость часа
 * - Рассчитывает сумму фактических затрат создателя
 * - Вычисляет фактическое изменение сумм генерации
 * - Создает коммит и отправляет на одобрение
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-создателя
 * @param project_hash Хеш проекта
 * @param commit_hash Хеш коммита
 * @param creator_hours Количество часов создателя
 * @param description Описание коммита
 * @param meta Метаданные коммита
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::createcmmt(eosio::name coopname, eosio::name username, checksum256 project_hash, checksum256 commit_hash, uint64_t creator_hours, std::string description, std::string meta){
  require_auth(coopname);
  
  // Проверяем существование проекта и получаем его
  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);
    
  // Проверяем, что проект в статусе "active"
  eosio::check(project.status == Capital::Projects::Status::ACTIVE, "Проект должен быть в статусе 'active'");
  
  // Проверяем основной договор УХД
  auto contributor = Capital::Contributors::get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Пайщик не подписывал основной договор УХД");
  eosio::check(contributor -> status == Capital::Contributors::Status::ACTIVE, "Основной договор УХД не активен");
  
  // Проверяем приложение к проекту
  eosio::check(Capital::Contributors::is_contributor_has_appendix_in_project(coopname, project_hash, contributor->id), 
               "Пайщик не подписывал приложение к договору УХД для данного проекта");
  
  // Проверяем, что действие с указанным хэшем не существует
  auto commit = Capital::Commits::get_commit(coopname, commit_hash);
  eosio::check(!commit.has_value(), "Коммит с указанным хэшем уже существует");
  
  // Проверяем, что сумма часов создателя больше 0 и не превышает 1 млн часов
  eosio::check(creator_hours > 0, "Только положительная сумма часов создателя");
  eosio::check(creator_hours <= 1000000, "Превышено максимальное количество часов (1 млн)");

  // Ставка часа на этом проекте: если мастер компонента утвердил её через approverole —
  // действует утверждённая, иначе личная ставка пайщика из contributors. Так мастер
  // дифференцирует ставку по проекту, не меняя договор УХД, а правка личной ставки
  // в профиле не переоценивает работу на проектах с утверждённой ставкой.
  auto segment_opt = Capital::Segments::get_segment(coopname, project_hash, username);
  eosio::asset effective_rate = contributor -> rate_per_hour;
  if (segment_opt.has_value()
      && segment_opt -> approved_rate_per_hour.has_value()
      && segment_opt -> approved_rate_per_hour -> amount > 0) {
    effective_rate = *segment_opt -> approved_rate_per_hour;
  }

  // Без положительной ставки себестоимость коммита = 0 — такой взнос потом не отработать
  eosio::check(effective_rate.amount > 0, "Не задана стоимость часа участника");

  // считаем сумму фактических затрат создателя на основе ставки в час и потраченного времени
  eosio::asset creator_base = effective_rate * creator_hours;

  // Вычисляем фактическое изменение сумм генерации
  auto delta_amounts = Capital::Core::Generation::calculate_fact_generation_amounts(effective_rate, creator_hours);
  
  // Создаем коммит без отправки на аппрув председателю
  // Одобрение осуществляется мастером проекта через approvecmmt
  Capital::Commits::create_commit(
    coopname,
    username,
    project_hash,
    commit_hash,
    description,
    meta,
    delta_amounts
  );
};
