#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

#include "../../entities/global_state.hpp"
#include "../../entities/segments.hpp"

namespace Capital::Gamification {

  /**
   * @brief Рассчитывает требуемую сумму вкладов для достижения указанного уровня
   * @param level Уровень, для которого нужно рассчитать требования
   * @param config Конфигурация контракта с параметрами геймификации
   * @return Требуемая сумма в микротокенах
   */
  inline uint64_t calculate_level_requirement(uint32_t level, const Capital::config& config);

  /**
   * @brief Рассчитывает прирост энергии от вклада
   * @param contribution_amount Сумма вклада
   * @param current_level Текущий уровень участника
   * @param config Конфигурация контракта с параметрами геймификации
   * @return Прирост энергии (0.0 - 100.0)
   */
  inline double calculate_energy_gain(eosio::asset contribution_amount, uint32_t current_level, const Capital::config& config);

  /**
   * @brief Обновляет энергию участника с учетом естественного снижения (decay)
   * @param coopname Имя кооператива
   * @param contributor_id ID участника
   */
  inline void update_energy_with_decay(eosio::name coopname, uint64_t contributor_id);

  /** Результат разнесения вклада по уровням. */
  struct LevelProgress {
    uint32_t level;   ///< уровень после начисления
    double energy;    ///< остаток энергии на достигнутом уровне (0..100)
  };

  /**
   * @brief Разносит вклад по уровням, списывая требование каждого пройденного
   * @param amount_minor Сумма вклада в минорных единицах
   * @param start_level Уровень до начисления
   * @param start_energy Накопленная энергия на этом уровне (0..100)
   * @param config Конфигурация контракта с параметрами геймификации
   */
  inline LevelProgress apply_contribution_to_levels(double amount_minor, uint32_t start_level,
                                                    double start_energy, const Capital::config& config);

  /**
   * @brief Начисляет вклад участнику и проверяет переход на новые уровни
   * @param coopname Имя кооператива
   * @param contributor_id ID участника
   * @param amount_minor Сумма вклада в минорных единицах
   */
  inline void add_contribution_and_check_levelup(eosio::name coopname, uint64_t contributor_id, double amount_minor);

  /**
   * @brief Обновляет геймификацию (уровень и энергию) на основе вкладов из сегмента
   * @param coopname Имя кооператива
   * @param contributor_id ID участника
   * @param segment Сегмент с данными о вкладах участника
   */
  inline void update_gamification_from_segment(eosio::name coopname, uint64_t contributor_id, const Capital::Segments::segment& segment);

} // namespace Capital::Gamification
