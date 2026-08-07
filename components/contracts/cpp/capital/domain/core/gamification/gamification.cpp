#include "gamification.hpp"
#include "../../entities/contributors.hpp"

namespace Capital::Gamification {

  /**
   * @brief Энергия, необходимая для перехода на следующий уровень
   *
   * Энергия измеряется в процентах пути до уровня: вклад размером
   * level_requirement закрывает уровень целиком.
   */
  static constexpr double ENERGY_PER_LEVEL = 100.0;

  inline uint64_t calculate_level_requirement(uint32_t level, const Capital::config& config) {
    if (level == 1) {
      return config.level_depth_base;
    }

    // level_requirement(N) = level_depth_base × level_growth_coefficient^(N-1)
    double multiplier = 1.0;
    for (uint32_t i = 1; i < level; i++) {
      multiplier *= config.level_growth_coefficient;
    }

    return static_cast<uint64_t>(config.level_depth_base * multiplier);
  }

  inline double calculate_energy_gain(eosio::asset contribution_amount, uint32_t current_level, const Capital::config& config) {
    if (contribution_amount.amount <= 0) {
      return 0.0;
    }

    uint64_t level_requirement = calculate_level_requirement(current_level, config);

    // Доля вклада от требования уровня переводится в проценты: вклад размером
    // level_depth_base (базовая сумма для первого уровня) даёт ровно один
    // уровень. Без перевода начисление выходило в сто раз меньше — на уровень
    // требовался миллион рублей вместо десяти тысяч, и подсказка «до
    // следующего уровня» в интерфейсе расходилась с цепью на тот же порядок.
    double gain = (static_cast<double>(contribution_amount.amount) / static_cast<double>(level_requirement))
                  * ENERGY_PER_LEVEL * config.energy_gain_coefficient;

    return gain;
  }

  inline void update_energy_with_decay(eosio::name coopname, uint64_t contributor_id) {
    Capital::contributor_index contributors(_capital, coopname.value);
    auto contributor = contributors.find(contributor_id);
    
    eosio::check(contributor != contributors.end(), "Участник не найден");

    auto config = Capital::State::get_global_state(coopname).config;
    auto current_time = eosio::current_time_point();

    contributors.modify(contributor, _capital, [&](auto &c) {
      // Рассчитываем сколько дней прошло с последнего обновления
      uint32_t seconds_passed = current_time.sec_since_epoch() - c.last_energy_update.sec_since_epoch();
      double days_passed = static_cast<double>(seconds_passed) / 86400.0;

      // Применяем процентное затухание энергии
      double decay = c.energy * config.energy_decay_rate_per_day * days_passed;
      c.energy = std::max(0.0, c.energy - decay);

      // Обновляем время последнего обновления
      c.last_energy_update = current_time;
    });
  }

  inline void add_energy_and_check_levelup(eosio::name coopname, uint64_t contributor_id, double energy_gain) {
    if (energy_gain <= 0.0) {
      return;
    }

    Capital::contributor_index contributors(_capital, coopname.value);
    auto contributor = contributors.find(contributor_id);

    eosio::check(contributor != contributors.end(), "Участник не найден");

    uint32_t prev_level = contributor->level;
    uint32_t new_level = 0;
    contributors.modify(contributor, _capital, [&](auto &c) {
      // Добавляем энергию
      c.energy += energy_gain;

      // Обновляем время последнего обновления
      c.last_energy_update = eosio::current_time_point();

      // Проверяем переход на новый уровень (поддержка перескока через несколько уровней)
      if (c.energy >= 100.0) {
        uint32_t levels_gained = static_cast<uint32_t>(c.energy / 100.0);
        c.level += levels_gained;
        new_level = c.level;
        c.energy = std::fmod(c.energy, 100.0);
      }
    });

    // Если уровень изменился, отправляем уведомление
    if (new_level > prev_level) {
      // Вызываем inline action для уведомления о переходе на новый уровень
      eosio::action(
        eosio::permission_level{_capital, "active"_n},
        _capital,
        "lvlnotify"_n,
        std::make_tuple(coopname, contributor -> username, prev_level, new_level)
      ).send();
    }
  }

  inline void update_gamification_from_segment(eosio::name coopname, uint64_t contributor_id, const Capital::Segments::segment& segment) {
    
    Capital::contributor_index contributors(_capital, coopname.value);
    auto contributor = contributors.find(contributor_id);
    
    
    if (contributor == contributors.end()) {
      return;
    }

    auto config = Capital::State::get_global_state(coopname).config;

    // Собираем все вклады из сегмента
    eosio::asset total_contribution = asset(0, _root_govern_symbol);

    if (segment.is_investor) {
      total_contribution += segment.investor_base;
    }

    if (segment.is_author) {
      total_contribution += (segment.author_base + segment.author_bonus);
    }

    if (segment.is_creator) {
      total_contribution += (segment.creator_base + segment.creator_bonus);
    }

    if (segment.is_coordinator) {
      total_contribution += segment.coordinator_base;
    }

    if (segment.is_contributor) {
      total_contribution += segment.contributor_bonus;
    }

    if (segment.is_propertor) {
      total_contribution += segment.property_base;
    }

    // Рассчитываем прирост энергии
    double energy_gain = calculate_energy_gain(total_contribution, contributor->level, config);

    // Добавляем энергию и проверяем переход уровня
    add_energy_and_check_levelup(coopname, contributor_id, energy_gain);
  }

} // namespace Capital::Gamification
