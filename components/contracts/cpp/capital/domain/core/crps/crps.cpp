#include "crps.hpp"

using namespace eosio;
using std::string;

// Подключение всех CRPS реализаций
#include "author_crps.cpp"
#include "contributor_crps.cpp"
#include "coordinator_share.cpp"  // Пропорциональное распределение для координаторов
#include "creator_crps.cpp"
#include "program_crps.cpp"
#include "propertor_segment.cpp"  // Обработка имущественных взносов

namespace Capital::Core {

  /**
   * @brief Обновляет сегмент участника - диспетчер для обновления всех ролей
   */
  void refresh_segment(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
    
    // Обновляем награды для каждой роли отдельно
    refresh_author_segment(coopname, segment_id, project);
    refresh_coordinator_segment(coopname, segment_id, project);
    refresh_contributor_segment(coopname, segment_id, project);
    
    // Пересчитываем доступную сумму к компенсации
    refresh_provisional_amount(coopname, segment_id, project);
    
    // Обновляем фактически используемую сумму инвестора если он является инвестором
    update_investor_used_amount(coopname, segment_id, project);
      
    // Обновляем общую стоимость сегмента в конце
    Capital::Segments::update_segment_total_cost(coopname, segment_id, project);

  }
  
    
  /**
  * @brief Проверяет является ли сегмент обновленным (CRPS актуален и инвестиции синхронизированы)
  * @param coopname Имя кооператива
  * @param project Проект
  * @param segment Сегмент
  * @return true если сегмент обновлен
  */
  inline bool is_segment_updated(eosio::name coopname, const Capital::project &project, const Capital::Segments::segment &segment) {
    // Проверяем актуальность CRPS для каждой роли
    bool author_updated = (!segment.is_author) || 
                        (segment.last_author_base_reward_per_share == project.crps.author_base_cumulative_reward_per_share &&
                          segment.last_author_bonus_reward_per_share == project.crps.author_bonus_cumulative_reward_per_share);
    
    // Координаторы используют пропорциональное распределение на основе coordinators_investment_pool
    bool coordinator_updated = (!segment.is_coordinator) || 
                              (segment.last_known_coordinators_investment_pool == project.fact.coordinators_investment_pool);
    
    bool contributor_updated = (!segment.is_contributor) || 
                              (segment.last_contributor_reward_per_share == project.crps.contributor_cumulative_reward_per_share);
    
    // Проверяем актуальность инвестиционного пула для расчета provisional_amount (нужно всем ролям)
    bool invest_pool_updated = (segment.last_known_invest_pool == project.fact.invest_pool);
    
    // Проверяем актуальность базового пула создателей для корректного расчета использования инвестиций (нужно только инвесторам)
    bool creators_base_pool_updated = (!segment.is_investor) || 
                                    (segment.last_known_creators_base_pool == project.fact.creators_base_pool);
    
    return author_updated && coordinator_updated && contributor_updated && invest_pool_updated && creators_base_pool_updated;
  }

  /**
  * @brief Проверяет является ли сегмент обновленным или падает с ошибкой
  */
  inline void check_segment_is_updated(eosio::name coopname, const Capital::project &project, const Capital::Segments::segment &segment, 
                                  const char* msg = "Сегмент не обновлен. Необходимо выполнить rfrshsegment") {
    eosio::check(is_segment_updated(coopname, project, segment), msg);
  }


  /**
   * @brief Пересчитывает доступную сумму к компенсации на основе инвестиций с учетом return_base_percent
   */
  void refresh_provisional_amount(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    if (segment == segments.end()) {
      return; // Сегмент не найден
    }
    
    // Базовые поля текущего пользователя (себестоимость труда)
    int64_t user_base_amount = segment->creator_base.amount + 
                              segment->author_base.amount + 
                              segment->coordinator_base.amount; //имущественный взнос здесь НЕ учитывается
    
    // Если нет себестоимости труда у пользователя, provisional_amount = 0
    if (user_base_amount == 0) {
      segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &s) {
        s.provisional_amount = eosio::asset(0, _root_govern_symbol);
        s.last_known_invest_pool = project.fact.invest_pool; // Все равно синхронизируем инвестиции
        s.last_known_creators_base_pool = project.fact.creators_base_pool; // Синхронизируем с актуальной суммой базового пула создателей
      });
      return;
    }
    
    // Рассчитываем provisional_amount с учетом return_base_percent (в процентах)
    double return_coefficient_percent = project.fact.return_base_percent;
    
    // provisional_amount = себестоимость_труда * (return_base_percent / 100)
    int64_t provisional_amount = static_cast<int64_t>(
      static_cast<double>(user_base_amount) * (return_coefficient_percent / 100.0)
    );
    
    eosio::check(provisional_amount <= project.fact.invest_pool.amount, "Cумма доступной ссуды не может превышать сумму инвестиций проекта");
    
    // Обновляем provisional_amount и синхронизируем известные пулы в сегменте
    segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &s) {
      s.provisional_amount = eosio::asset(provisional_amount, _root_govern_symbol);
      s.last_known_invest_pool = project.fact.invest_pool; // Синхронизируем с актуальной суммой инвестиций
      s.last_known_creators_base_pool = project.fact.creators_base_pool; // Синхронизируем с актуальной суммой базового пула создателей
    });
  }



  /**
   * @brief Создает или обновляет запись инвестора в таблице segments
   */
  void upsert_investor_segment(eosio::name coopname, uint64_t segment_id, uint64_t project_id, 
                                        eosio::name username, const eosio::asset &investor_amount) {
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    
    auto project = Capital::Projects::get_project_by_id_or_fail(coopname, project_id);
    
    if (segment == segments.end()) {
        segments.emplace(RamPayer::of(segments, coopname), [&](auto &g){
            g.id            = segment_id;
            g.coopname      = coopname;
            g.project_hash  = project.project_hash;
            g.username      = username;
            g.investor_amount = investor_amount;
            g.is_investor = true;

            // Сразу регистрируем инвестора как контрибьютора (участника)
            g.is_contributor = true;
            g.capital_contributor_shares = investor_amount;
            g.last_contributor_reward_per_share = project.crps.contributor_cumulative_reward_per_share;
        });

        // Увеличиваем счетчики для нового участника
        Capital::Projects::increment_total_unique_participants(coopname, project_id);
        Capital::Projects::increment_total_investors(coopname, project_id);
        
        // Увеличиваем счетчики контрибьютора
        Capital::Projects::increment_total_contributors(coopname, project_id);
        
    } else {
        // 1. Сначала обновляем текущие награды на старые доли,
        // чтобы зафиксировать прирост до изменения количества долей.
        // Это обновит last_contributor_reward_per_share в таблице.
        refresh_contributor_segment(coopname, segment_id, project);
        
        // 2. Получаем АКТУАЛЬНЫЙ итератор сегмента из таблицы после обновления
        Segments::segments_index segments_updated(_capital, coopname.value);
        auto segment_updated = segments_updated.find(segment_id);

        bool became_investor = !segment_updated->is_investor;
        bool became_contributor = !segment_updated->is_contributor;

        // 3. Модифицируем уже обновленный сегмент
        segments_updated.modify(segment_updated, RamPayer::of(segments_updated, coopname), [&](auto &g) {
            if (became_investor) {
                g.is_investor = true;
                Capital::Projects::increment_total_investors(coopname, project_id);
            }
            g.investor_amount += investor_amount;

            if (became_contributor) {
                g.is_contributor = true;
                g.capital_contributor_shares = investor_amount;
                g.last_contributor_reward_per_share = project.crps.contributor_cumulative_reward_per_share;
            } else {
                g.capital_contributor_shares += investor_amount;
                // Награды и точка отсчета уже синхронизированы в п.1
            }
        });

        if (became_contributor) {
            Capital::Projects::increment_total_contributors(coopname, project_id);
        }
        
    }
    
    
    // Всегда увеличиваем общие доли в проекте на сумму новой инвестиции
    Capital::Projects::increment_total_contributor_shares(coopname, project_id, investor_amount);
    
    // Обновляем фактически используемую сумму инвестора с учетом коэффициента
    update_investor_used_amount(coopname, segment_id, project);
    
    // Обновляем общую стоимость сегмента
    Capital::Segments::update_segment_total_cost(coopname, segment_id, project);
  }

  /**
   * @brief Обновляет фактически используемую сумму инвестора в сегменте с учетом коэффициента возврата
   * @param coopname Имя кооператива
   * @param segment_id ID сегмента
   * @param project Проект
   */
  void update_investor_used_amount(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    
    if (segment == segments.end() || !segment->is_investor) {
      return; // Не инвестор
    }
    
    segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &s) {
      // Рассчитываем фактически используемую сумму инвестора (используем коэффициент возврата инвестиций)
      s.investor_base = Capital::Core::Generation::calculate_investor_used_amount(
        s.investor_amount, 
        project.fact.use_invest_percent
      );
      // Синхронизируем известные пулы для корректного определения необходимости обновления сегмента
      s.last_known_invest_pool = project.fact.invest_pool;
      s.last_known_creators_base_pool = project.fact.creators_base_pool;
    });
  }

}