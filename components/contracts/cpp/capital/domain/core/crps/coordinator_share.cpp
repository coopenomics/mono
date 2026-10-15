#include "crps.hpp"

namespace Capital::Core {

  /**
   * @brief Рассчитывает координаторскую премию как процент от привлеченных им средств
   * @param coordinator_investments Сумма инвестиций, привлеченная координатором
   * @param referal_percent Процент вознаграждения координатора (например, 0.04 для 4%)
   * @return Премия координатора
   */
  inline eosio::asset calculate_coordinator_direct_reward(
    const eosio::asset &coordinator_investments,
    double referal_percent
  ) {
    if (coordinator_investments.amount == 0) {
      return eosio::asset(0, _root_govern_symbol);
    }

    // Прямой расчет: coordinator_base = Yn * referal_percent
    int64_t coordinator_reward = static_cast<int64_t>(
      static_cast<double>(coordinator_investments.amount) * referal_percent
    );

    return eosio::asset(coordinator_reward, _root_govern_symbol);
  }

  
/**
 * @brief Создает или обновляет запись координатора в таблице segments.
 * @param coopname Имя кооператива (scope таблицы).
 * @param segment_id ID сегмента.
 * @param project Проект.
 * @param username Имя пользователя координатора.
 * @param rised_amount Сумма привлеченных средств.
 */
void upsert_coordinator_segment(eosio::name coopname, uint64_t segment_id, uint64_t project_id, 
                                       eosio::name username, const eosio::asset &rised_amount) {
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    auto project = Capital::Projects::get_project_by_id_or_fail(coopname, project_id);

    if (segment == segments.end()) {
        segments.emplace(RamPayer::of(segments, coopname), [&](auto &g){
            g.id            = segment_id;
            g.coopname      = coopname;
            g.project_hash  = project.project_hash;
            g.username      = username;
            g.coordinator_investments   = rised_amount;
            g.is_coordinator = true;
            // Инициализируем отслеживаемые поля для корректной работы пропорционального распределения
            g.last_known_coordinators_investment_pool = project.fact.coordinators_investment_pool;
        });

        // Увеличиваем счетчики для нового участника
        Capital::Projects::increment_total_unique_participants(coopname, project_id);
        Capital::Projects::increment_total_coordinators(coopname, project_id);
    } else {
        segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &g) {
            if (!g.is_coordinator) {
                g.is_coordinator = true;
                Capital::Projects::increment_total_coordinators(coopname, project_id);
            }
            g.coordinator_investments += rised_amount;
            // Обновляем отслеживаемые поля при изменении coordinator_investments
            g.last_known_coordinators_investment_pool = project.fact.coordinators_investment_pool;
        });
    }
    
}

  /**
   * @brief Обновляет награды координатора в сегменте на основе прямого расчета (O(1) операция)
   */
  void refresh_coordinator_segment(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    
    if (segment == segments.end() || !segment->is_coordinator) {
      return; // Сегмент не найден или пользователь не координатор
    }
    
    // Если координатор ничего не привлек, обнуляем его базу
    if (segment->coordinator_investments.amount == 0) {
      segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &s) {
        s.coordinator_base = asset(0, _root_govern_symbol);
        s.last_known_coordinators_investment_pool = project.fact.coordinators_investment_pool;
      });
      return;
    }
    
    // Получаем конфигурацию кооператива для процента координатора
    auto global_state = Capital::State::get_global_state(coopname);
    double referal_percent = global_state.config.coordinator_bonus_percent / 100.0; // Конвертируем из процентов в доли
    
    // Прямой расчет: coordinator_base = Yn * referal_percent
    eosio::asset new_coordinator_base = calculate_coordinator_direct_reward(
      segment->coordinator_investments,
      referal_percent
    );
    
    // Обновляем сегмент координатора
    segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &s) {
      s.coordinator_base = new_coordinator_base;
      s.last_known_coordinators_investment_pool = project.fact.coordinators_investment_pool;
    });
  }

}// namespace Capital::Core