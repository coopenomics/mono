using namespace eosio;
using std::string;

namespace Capital::Core {
  
  /**
   * @brief Добавляет средства в глобальный пул доступных инвестиций программы
   */
  void add_program_investment_funds(eosio::name coopname, asset amount) {
    auto state = Capital::State::get_global_state(coopname);
    
    // Добавляем средства в глобальный пул доступных для аллокации инвестиций
    state.global_available_invest_pool += amount;

    Capital::State::update_global_state(state);
  }

  /**
   * @brief Аллоцирует средства из глобального пула в проект согласно правилу распределения
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @param amount Сумма для аллокации
   */
  void allocate_program_investment_to_project(eosio::name coopname, uint64_t project_id, eosio::asset amount) {
    auto state = Capital::State::get_global_state(coopname);
    
    // Проверяем что в глобальном пуле достаточно средств
    eosio::check(state.global_available_invest_pool >= amount, "Недостаточно средств в глобальном пуле инвестиций");
    
    // Получаем проект для модификации
    Capital::project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    
    projects.modify(project, coopname, [&](auto &p) {
      // Рассчитываем сколько средств еще нужно для достижения цели по расходам
      eosio::asset expense_gap = p.plan.target_expense_pool - p.fact.accumulated_expense_pool;
      
      // Рассчитываем какую часть инвестиций направить в пул расходов
      eosio::asset to_expense_pool = asset(0, _root_govern_symbol);
      
      if (expense_gap.amount > 0) {
        // Рассчитываем процент от инвестиций для пула расходов
        auto st = Capital::State::get_global_state(coopname);
        eosio::asset potential_to_expense = amount * st.config.expense_pool_percent / 100;
        
        // Но не больше, чем нужно для достижения цели
        to_expense_pool = (potential_to_expense.amount <= expense_gap.amount) ? potential_to_expense : expense_gap;
      }
      
      // Остальные средства идут в инвестиционные пулы
        eosio::asset to_invest_pool = amount - to_expense_pool;
      
      // Обновляем пулы проекта
      // Добавляем в invest_pool для корректного расчета CRPS
      p.fact.invest_pool += to_invest_pool;
      // Также фиксируем в program_invest_pool для отслеживания программных средств
      p.fact.program_invest_pool += to_invest_pool;
      p.fact.accumulated_expense_pool += to_expense_pool;
      p.fact.total_received_investments += amount;  // Увеличиваем общую сумму полученных инвестиций
      
      // Пересчитываем коэффициенты возврата
      p.fact.return_base_percent = Capital::Core::Generation::calculate_return_base_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.invest_pool);
      p.fact.use_invest_percent = Capital::Core::Generation::calculate_use_invest_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.accumulated_expense_pool, p.fact.used_expense_pool, p.fact.total_received_investments);
      
      // Пересчитываем используемую часть инвестиций и полную стоимость
      p.fact.total_used_investments = eosio::asset(
          static_cast<int64_t>(static_cast<double>(p.fact.total_received_investments.amount) * (p.fact.use_invest_percent / 100.0)),
          _root_govern_symbol
      );
      p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments;
    });
    
    // Списываем средства из глобального пула
    state.global_available_invest_pool -= amount;
    Capital::State::update_global_state(state);
  }

  /**
   * @brief Диаллоцирует средства из проекта обратно в глобальный пул (после закрытия проекта)
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @param amount Сумма для диаллокации
   */
  void deallocate_program_investment_from_project(eosio::name coopname, uint64_t project_id, eosio::asset amount) {
    // Получаем проект для модификации
    Capital::project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    
    // Проверяем что в проекте достаточно программных средств
    eosio::check(project->fact.program_invest_pool >= amount, "Недостаточно программных средств в проекте");
    
    projects.modify(project, coopname, [&](auto &p) {
      // Списываем средства из программного инвестиционного пула проекта
      p.fact.program_invest_pool -= amount;
      // коэффициент возврата не трогаем т.к. проект уже закрыт
    });
    
    // Возвращаем средства в глобальный пул
    auto state = Capital::State::get_global_state(coopname);
    state.global_available_invest_pool += amount;
    Capital::State::update_global_state(state);
  }

  /**
   * @brief Возвращает неизрасходованные средства проекта в программу
   *
   * Списывает возвращаемую сумму с пулов проекта и отправляет трекинговое
   * действие returntopool, которое зачислит её в свободные средства программы.
   *
   * Списание обязательно: без него повторный возврат по тому же проекту отдал
   * бы те же деньги ещё раз. Это не умозрительный случай — проект можно
   * остановить (возврат), запустить снова и затем отменить (второй возврат).
   * После списания повторный вызов вернёт ноль и ничего не отправит.
   *
   * Раскладка возврата обратна раскладке аллокации: сначала снимается
   * незадействованный резерв расходов (accumulated_expense_pool сверх
   * потраченного), остаток — с инвестиционных пулов.
   *
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @return Возвращённая сумма (ноль, если возвращать нечего)
   */
  eosio::asset return_unused_investments(eosio::name coopname, uint64_t project_id) {
    Capital::project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");

    eosio::asset unused = Capital::Projects::calculate_unused_investments(*project);
    if (unused.amount == 0) return unused;

    projects.modify(project, coopname, [&](auto &p) {
      // Незадействованный резерв расходов — первая часть возврата.
      int64_t expense_reserve = p.fact.accumulated_expense_pool.amount - p.fact.used_expense_pool.amount;
      int64_t from_expense = expense_reserve > 0 ? std::min(expense_reserve, unused.amount) : 0;
      int64_t from_invest = unused.amount - from_expense;

      p.fact.accumulated_expense_pool -= eosio::asset(from_expense, _root_govern_symbol);

      // Инвестиционные пулы уменьшаем в пределах их остатка: часть возврата
      // может приходиться на прямые инвестиции пайщиков, которых нет в
      // программном пуле.
      int64_t from_program = std::min(from_invest, p.fact.program_invest_pool.amount);
      p.fact.program_invest_pool -= eosio::asset(from_program, _root_govern_symbol);

      int64_t from_invest_pool = std::min(from_invest, p.fact.invest_pool.amount);
      p.fact.invest_pool -= eosio::asset(from_invest_pool, _root_govern_symbol);

      p.fact.total_received_investments -= unused;
      p.fact.total_returned_investments += unused;

      // Пересчитываем коэффициенты — те же формулы, что при аллокации.
      p.fact.return_base_percent = Capital::Core::Generation::calculate_return_base_percent(
        p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.invest_pool);
      p.fact.use_invest_percent = Capital::Core::Generation::calculate_use_invest_percent(
        p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool,
        p.fact.accumulated_expense_pool, p.fact.used_expense_pool, p.fact.total_received_investments);

      p.fact.total_used_investments = eosio::asset(
        static_cast<int64_t>(static_cast<double>(p.fact.total_received_investments.amount) * (p.fact.use_invest_percent / 100.0)),
        _root_govern_symbol);
      p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments;
    });

    // Зачисление в программу — трекинговым действием, чтобы возврат был виден
    // в истории отдельной записью. Оно исполняется после текущего действия,
    // в том числе после удаления строки проекта.
    action(
      permission_level{_capital, "active"_n},
      _capital,
      "returntopool"_n,
      std::make_tuple(coopname, project->project_hash, unused)
    ).send();

    return unused;
  }

} // namespace Capital::Core