// Порядок действий поправлен возможно правильный но share_percent всегда по нулям. Возможно здесь проблема а может и в другом месте. 
/**
 * @brief Создает инвестицию в проект
 * Создает инвестицию в проект и проводит все связанные операции:
 * - Проверяет подлинность заявления об инвестиции
 * - Валидирует сумму инвестиции
 * - Проверяет активность договора УХД и приложения к проекту
 * - Валидирует статус проекта (открыт для инвестиций)
 * - Списывает сумму с доступного остатка кошелька программы благороста
 * - Добавляет инвестора как генератора с investor_base
 * - Обновляет проект - добавляет инвестиции
 * - Обрабатывает координаторские взносы если есть координатор
 * - Зачисляет сумму на кошелёк программы благороста (заблокировано)
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-инвестора
 * @param project_hash Хеш проекта для инвестиции
 * @param invest_hash Хеш инвестиции
 * @param amount Сумма инвестиции
 * @param statement Заявление об инвестиции
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
 void capital::createinvest(name coopname, name username, checksum256 project_hash, checksum256 invest_hash, asset amount, document2 statement) {
  require_auth(coopname);
  
  verify_document_or_fail(statement, {username});

  // Проверяем существование проекта
  Wallet::validate_asset(amount);

  // Проверяем основной договор УХД
  auto contributor = Capital::Contributors::get_active_contributor_with_appendix_or_fail(coopname, project_hash, username);

  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  eosio::check(project.is_opened == true, "Проект закрыт для инвестиций");

  eosio::check(project.status == Capital::Projects::Status::ACTIVE, "Проект должен быть в статусе 'active'");

  std::string memo = Capital::Memo::get_invest_memo(contributor -> id);

  // Получаем информацию о координаторе и его сумме для взноса
  auto coordinator_info = Capital::Invests::get_coordinator_amount(coopname, username, amount);

  eosio::name coordinator_username = eosio::name{};
  asset coordinator_amount = asset(0, _root_symbol);

  // Получаем информацию о координаторе
  if (coordinator_info.has_value()) {
    auto [coord_username, coord_amount] = *coordinator_info;
    coordinator_username = coord_username;
    coordinator_amount = coord_amount;
  }

  auto segment = Capital::Segments::get_segment(coopname, project.project_hash, username);
  uint64_t segment_id = 0;
  if (segment.has_value()) {
    segment_id = segment.value().id;
    Capital::Core::check_segment_is_updated(coopname, project, segment.value());
  } else {
    segment_id = Capital::Segments::get_segment_id(coopname);
  }
  
  bool has_coordinator = coordinator_username != eosio::name{} && coordinator_amount.amount > 0;
  uint64_t coordinator_segment_id = 0;
    
  // Обрабатываем координаторские взносы, если есть координатор и сумма
  if (has_coordinator) {
    // Получаем или создаем segment_id для координатора (это другой пользователь!)
    auto coordinator_segment = Capital::Segments::get_segment(coopname, project.project_hash, coordinator_username);
    
    if (coordinator_segment.has_value()) {
      coordinator_segment_id = coordinator_segment.value().id;
    } else {
      coordinator_segment_id = Capital::Segments::get_segment_id(coopname);
    }
    
  }
  
  // 1. Обновляем проект - добавляем инвестиции (обновляет invest_pool)
  Capital::Projects::add_investments(coopname, project.id, amount);

  // 2. Сначала обрабатываем координаторские взносы (если есть координатор)
  // Это КРИТИЧНО: add_coordinator_funds увеличивает CRPS награды существующих участников
  // Мы должны сделать это ДО upsert_investor_segment, чтобы новый инвестор
  // зафиксировал last_contributor_reward_per_share уже ПОСЛЕ обновления CRPS.
  // Иначе инвестор получит награды от своего же взноса через координатора!
  if (has_coordinator) {
    Capital::Core::Generation::add_coordinator_funds(coopname, project.id, coordinator_amount);
    
    // Создаём сегмент координатора
    Capital::Core::upsert_coordinator_segment(coopname, coordinator_segment_id, project.id, coordinator_username, coordinator_amount);
  }
  
  // 3. Добавляем инвестора как генератора с investor_base
  // Теперь last_contributor_reward_per_share фиксируется ПОСЛЕ того как CRPS обновлен координаторскими выплатами
  Capital::Core::upsert_investor_segment(coopname, segment_id, project.id, username, amount); 

  
  // Обновляем накопительный показатель инвестора - увеличиваем contributed_as_investor сразу на всю сумму инвестиции
  // Это необходимо, т.к. чистые инвесторы не вносят результат и не проходят через signact2, где обычно обновляются рейтинги
  Capital::Contributors::increase_investor_contribution(coopname, contributor->id, amount);

  // Получаем обновленный сегмент и обновляем геймификацию (уровень и энергию)
  // Это важно для чистых инвесторов, которые не проходят через signact2
  auto updated_segment = Capital::Segments::get_segment_by_id_or_fail(coopname, segment_id, "Сегмент инвестора не найден");
  Capital::Gamification::update_gamification_from_segment(coopname, contributor->id, updated_segment);

  // ledger2: TRANSFER w.wal.share → w.cap.blago (без бухпроводки — оба счёта 80).
  // Источник правды UI для балансов кошельков пайщика — L3 ledger2::userwallets.
  Ledger2::apply(_capital, coopname, operations::capital::INVEST, amount,
                 contributor -> username, invest_hash, memo);

  // Фиксируем заявление об инвестиции в реестре
  Soviet::make_complete_document(
    _capital,
    coopname,
    username,
    Names::Capital::CREATE_INVESTMENT,
    invest_hash,
    statement
  );

}