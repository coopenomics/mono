#include "generation.hpp"
#include "../../entities/projects.hpp"
#include "../crps/crps.hpp"

using namespace eosio;
using std::string;

namespace Capital::Core::Generation {
  
  
  /**
  * @brief Функция расчета премий участников (для фактических показателей)
  */
  eosio::asset calculate_contributors_bonus_pool(eosio::asset total_generation_pool) {
    return eosio::asset(int64_t(static_cast<double>(
      total_generation_pool.amount
    ) * CONTRIBUTORS_BONUS_COEFFICIENT), _root_govern_symbol);
  }

  /**
  * @brief Функция расчета коэффициента возврата себестоимости (для фактических показателей)
  */
  double calculate_return_base_percent(eosio::asset creators_base_pool, eosio::asset authors_base_pool, eosio::asset coordinators_base_pool, eosio::asset invest_pool) {
    // Только трудозатраты (без расходов)
    double work_costs = static_cast<double>(
      creators_base_pool.amount +
      authors_base_pool.amount +
      coordinators_base_pool.amount
    );
    
    // Если нет трудозатрат, коэффициент = 0%
    if (work_costs == 0.0) {
      return 0.0;
    }
    
    double available_investments = static_cast<double>(invest_pool.amount);
    
    // Коэффициент в процентах показывает какую долю себестоимости можно компенсировать
    // Не может быть больше 100.0% компенсации
    double coefficient_percent = (available_investments / work_costs) * 100.0;
    return coefficient_percent > 100.0 ? 100.0 : coefficient_percent;
  }

  /**
   * @brief Функция расчета коэффициента возврата инвестиций для плановых показателей
   */
  double calculate_use_invest_percent_planned(eosio::asset creators_base_pool, eosio::asset authors_base_pool, eosio::asset coordinators_base_pool, eosio::asset target_expense_pool, eosio::asset total_received_investments) {
    // Используем общую сумму инвестиций
    if (total_received_investments.amount == 0) {
      return 0.0;
    }
    
    // Все затраты проекта (трудозатраты + расходы)
    double total_costs = static_cast<double>(
      creators_base_pool.amount +
      authors_base_pool.amount +
      coordinators_base_pool.amount +
      target_expense_pool.amount
    );
    
    double total_investments = static_cast<double>(total_received_investments.amount);
    
    // Коэффициент в процентах показывает долю инвестиций, которая используется
    // Физически не может быть больше 100.0% использования
    double coefficient_percent = (total_costs / total_investments) * 100.0;
    return coefficient_percent > 100.0 ? 100.0 : coefficient_percent;
  }
  
  /**
   * @brief Функция расчета коэффициента возврата инвестиций для фактических показателей
   */
  double calculate_use_invest_percent(eosio::asset creators_base_pool, eosio::asset authors_base_pool, eosio::asset coordinators_base_pool, eosio::asset accumulated_expense_pool, eosio::asset used_expense_pool, eosio::asset total_received_investments) {
    // Используем общую сумму инвестиций
    if (total_received_investments.amount == 0) {
      return 0.0;
    }
    
    // Все затраты проекта (трудозатраты + фактические расходы)
    double total_costs = static_cast<double>(
      creators_base_pool.amount +
      authors_base_pool.amount +
      coordinators_base_pool.amount +
      accumulated_expense_pool.amount +
      used_expense_pool.amount
    );
    
    double total_investments = static_cast<double>(total_received_investments.amount);
    
    // Коэффициент в процентах показывает долю инвестиций, которая используется
    // Физически не может быть больше 100.0% использования
    double coefficient_percent = (total_costs / total_investments) * 100.0;
    return coefficient_percent > 100.0 ? 100.0 : coefficient_percent;
  }

  /**
   * @brief Функция расчета плановых показателей проекта
   */
  plan_pool calculate_plan_generation_amounts(
    eosio::name coopname,
    const eosio::asset& plan_hour_cost,
    const uint64_t& plan_creators_hours,
    const eosio::asset& plan_expenses
  ) {
    // читаем конфиг
    auto st = Capital::State::get_global_state(coopname);
    
    plan_pool plan;
    
    // устанавливаем стоимость часа и время
    plan.hour_cost = plan_hour_cost;
    plan.creators_hours = plan_creators_hours;
    
    // инициализируем поля расходов
    plan.target_expense_pool = plan_expenses; // планируемые расходы
    
    // расчет плановой себестоимости создателя (double)
    double creator_double_amount = static_cast<double>(plan_creators_hours) * static_cast<double>(plan_hour_cost.amount);
    
    // расчет плановой себестоимости создателя
    plan.creators_base_pool = asset(int64_t(creator_double_amount), _root_govern_symbol);
    
    // расчет авторской себестоимости (double)
    double author_double_amount = static_cast<double>(creator_double_amount * AUTHOR_BASE_COEFFICIENT);
          
    // расчет авторской себестоимости
    plan.authors_base_pool = eosio::asset(int64_t(author_double_amount), _root_govern_symbol);
    
    // расчет планируемых премий координаторов
    
    // Сумма всех базовых затрат, которые нужно покрыть
    eosio::asset base_costs = plan.creators_base_pool + plan.authors_base_pool + plan.target_expense_pool;
    
    // Рассчитываем премию координатора через обратный процент для плана
    plan.coordinators_base_pool = calculate_coordinator_bonus_plan(coopname, base_costs);

    // расчет премий создателя
    double creators_bonus_double = static_cast<double>(plan.creators_base_pool.amount * CREATORS_BONUS_COEFFICIENT);
    plan.creators_bonus_pool = eosio::asset(int64_t(creators_bonus_double), _root_govern_symbol);
    
    // расчет премий авторов
    double authors_bonus_double = static_cast<double>(plan.authors_base_pool.amount * AUTHOR_BONUS_COEFFICIENT);
    plan.authors_bonus_pool = eosio::asset(int64_t(authors_bonus_double), _root_govern_symbol);
    
    // расчет общей планируемой суммы инвестиций (все затраты)
    plan.total_received_investments = plan.creators_base_pool + plan.authors_base_pool + plan.coordinators_base_pool + plan.target_expense_pool;
    
    // расчет планируемой суммы инвестиций (только для трудозатрат, после вычета расходов)
    plan.invest_pool = plan.creators_base_pool + plan.authors_base_pool + plan.coordinators_base_pool;

    // расчет суммы, которую координаторы привлекут в проект
    // считаем, что координаторы будут привлекать всю общую сумму инвестиций
    plan.coordinators_investment_pool = plan.total_received_investments;    
    
    // коэффициенты возврата
    plan.return_base_percent = calculate_return_base_percent(plan.creators_base_pool, plan.authors_base_pool, plan.coordinators_base_pool, plan.invest_pool);
    plan.use_invest_percent = calculate_use_invest_percent_planned(plan.creators_base_pool, plan.authors_base_pool, plan.coordinators_base_pool, plan.target_expense_pool, plan.total_received_investments);
    
    plan.total_generation_pool = plan.creators_base_pool + plan.authors_base_pool + plan.coordinators_base_pool + plan.creators_bonus_pool + plan.authors_bonus_pool;
    
    // расчет премий участников
    plan.contributors_bonus_pool = calculate_contributors_bonus_pool(plan.total_generation_pool);
    
    // Общая планируемая сумма генерации с участниками (без расходов)
    plan.total = plan.total_generation_pool + plan.contributors_bonus_pool;
    
    // Полная планируемая стоимость проекта с инвестициями и расходами
    plan.total_with_investments = plan.total + plan.total_received_investments;
    
    return plan;
  }

  /**
   * @brief Функция расчета фактических показателей генерации в проекте по времени создателей
   */
  generation_amounts calculate_fact_generation_amounts(eosio::asset rate_per_hour, uint64_t creator_hours) {
    generation_amounts fact;
    
    // расчет фактических показателей генерации
    fact.creators_hours = creator_hours;
    fact.hour_cost = rate_per_hour;
    
    // расчет себестоимости создателя
    double creator_base_double = static_cast<double>(creator_hours) * static_cast<double>(rate_per_hour.amount);    
    fact.creators_base_pool = eosio::asset(int64_t(creator_base_double), _root_govern_symbol);
    
    // расчет премий создателя
    double creators_bonus_double = static_cast<double>(creator_base_double * CREATORS_BONUS_COEFFICIENT);
    fact.creators_bonus_pool = eosio::asset(int64_t(creators_bonus_double), _root_govern_symbol);
    
    // расчет авторской себестоимости
    double author_base_double = static_cast<double>(creator_base_double * AUTHOR_BASE_COEFFICIENT);
    fact.authors_base_pool = eosio::asset(int64_t(author_base_double), _root_govern_symbol);  // 0.618 от creator_base
    
    // расчет премий авторов
    fact.authors_bonus_pool = eosio::asset(int64_t(author_base_double * AUTHOR_BONUS_COEFFICIENT), _root_govern_symbol);
    
    // расчет общей суммы генерации коммита (без координаторов, они учитываются отдельно)
    fact.total_generation_pool = fact.creators_base_pool + fact.authors_base_pool + fact.creators_bonus_pool + fact.authors_bonus_pool;
    
    // Расчет премий участников от общей суммы генерации коммита
    fact.contributors_bonus_pool = eosio::asset(int64_t(static_cast<double>(
      fact.total_generation_pool.amount
    ) * CONTRIBUTORS_BONUS_COEFFICIENT), _root_govern_symbol);
    
    // Расчет общей суммы вкладов всех пайщиков (генерация + премии участников)
    fact.total_contribution = fact.total_generation_pool + fact.contributors_bonus_pool;
    
    return fact;
  }

  /**
   * @brief Функция расчета премий координаторов от инвестиций (прямой процент)
   */
  eosio::asset calculate_coordinator_bonus_from_investment(name coopname, const eosio::asset& investment_amount) {
    auto st = Capital::State::get_global_state(coopname);
    double amount = static_cast<double>(investment_amount.amount);
    eosio::symbol sym = investment_amount.symbol;
    
    // Рассчитываем премию координатора как прямой процент от инвестиций
    double k = st.config.coordinator_bonus_percent / 100.0;
    return eosio::asset(int64_t(amount * k), sym);
  }

  /**
   * @brief Функция расчета премии координатора для плана (обратный процент)
   * Используется в плане, чтобы при заложении суммы инвестиций, 
   * после вычета прямого процента координатора в факте, осталась ровно целевая сумма.
   */
  eosio::asset calculate_coordinator_bonus_plan(name coopname, const eosio::asset& base_costs) {
    auto st = Capital::State::get_global_state(coopname);
    double k = static_cast<double>(st.config.coordinator_bonus_percent) / 100.0;
    
    // Премия = base_costs * k / (1 - k)
    double bonus_double = static_cast<double>(base_costs.amount) * k / (1.0 - k);
    
    return eosio::asset(int64_t(bonus_double), base_costs.symbol);
  }

  /**
   * @brief Рассчитывает фактически используемую сумму инвестора с учетом коэффициента использования
   * @param investor_amount Общая сумма инвестора
   * @param use_invest_percent_percent Коэффициент используемых инвестиций в процентах (от 0.0 до 100.0)
   * @return Фактически используемая сумма инвестора
   */
  eosio::asset calculate_investor_used_amount(const eosio::asset& investor_amount, double use_invest_percent_percent) {
    // Используемая сумма = общая_сумма * (коэффициент_процентов / 100)
    double used_amount = static_cast<double>(investor_amount.amount) * (use_invest_percent_percent / 100.0);
    
    return eosio::asset(static_cast<int64_t>(used_amount), investor_amount.symbol);
  }

  /**
   * @brief Добавляет координаторские средства к проекту
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @param amount Сумма координаторских взносов для добавления
   */
  void add_coordinator_funds(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
      Capital::project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      
      // Рассчитываем награду координаторов от инвестиций
      eosio::asset coordinator_base = calculate_coordinator_bonus_from_investment(coopname, amount);
      
      eosio::asset delta_contributors_bonus_pool;
      
      projects.modify(project, RamPayer::of(projects, coopname), [&](auto &p) {
          // 1. Накапливаем инвестиции, привлеченные координаторами  
          p.fact.coordinators_investment_pool += amount;
          
          // 2. Накапливаем общий пул премий координаторов
          p.fact.coordinators_base_pool += coordinator_base;
          
          // 3. Пересчитываем общую сумму генерации, ВКЛЮЧАЯ премии координаторов
          p.fact.total_generation_pool = p.fact.creators_base_pool + p.fact.authors_base_pool + 
                                          p.fact.creators_bonus_pool + p.fact.authors_bonus_pool + 
                                          p.fact.coordinators_base_pool;

          // 4. Пересчитываем коэффициенты
          p.fact.return_base_percent = calculate_return_base_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.invest_pool);
          p.fact.use_invest_percent = calculate_use_invest_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.accumulated_expense_pool, p.fact.used_expense_pool, p.fact.total_received_investments);
          
          // 5. Рассчитываем дельту бонуса участников
          eosio::asset old_pool = p.fact.contributors_bonus_pool;
          p.fact.contributors_bonus_pool = calculate_contributors_bonus_pool(p.fact.total_generation_pool);
          delta_contributors_bonus_pool = p.fact.contributors_bonus_pool - old_pool;

          // 6. Синхронизируем остальные поля проекта
          p.fact.total_contribution = p.fact.total_generation_pool + p.fact.contributors_bonus_pool;
          p.fact.total = p.fact.total_contribution;
          
          p.fact.total_used_investments = eosio::asset(
              static_cast<int64_t>(static_cast<double>(p.fact.total_received_investments.amount) * (p.fact.use_invest_percent / 100.0)),
              _root_govern_symbol
          );
          p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments + p.fact.used_expense_pool;
      });

      // 7. Распределяем награду между СУЩЕСТВУЮЩИМИ участниками через CRPS
      if (delta_contributors_bonus_pool.amount > 0) {
          Capital::Core::increment_contributors_crps_in_project(coopname, project_id, delta_contributors_bonus_pool);
      }
  }

} // namespace Capital::Core