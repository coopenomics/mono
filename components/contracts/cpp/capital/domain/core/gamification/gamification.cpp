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
    //
    // Множитель растёт геометрически и на больших уровнях уходит в
    // бесконечность. Приведение inf к uint64_t — неопределённое поведение: у
    // участников, набравших уровни по сломанной формуле, энергия из-за этого
    // становилась NaN и уже не восстанавливалась. Ограничиваем требование
    // сверху и выходим из цикла, как только предел достигнут.
    static const double kMaxRequirement = 9.0e18;

    double requirement = static_cast<double>(config.level_depth_base);
    for (uint32_t i = 1; i < level; i++) {
      requirement *= config.level_growth_coefficient;
      if (!(requirement < kMaxRequirement)) {
        return static_cast<uint64_t>(kMaxRequirement);
      }
    }

    if (!(requirement > 0.0)) {
      return 0;
    }

    return static_cast<uint64_t>(requirement);
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
    //
    // ВНИМАНИЕ: значение осмысленно только В ПРЕДЕЛАХ ТЕКУЩЕГО УРОВНЯ. Вклад,
    // перекрывающий уровень, нельзя делить на сотню линейно — требование
    // следующего уровня выше в level_growth_coefficient раз. Для начисления
    // используйте apply_contribution_to_levels.
    double gain = (static_cast<double>(contribution_amount.amount) / static_cast<double>(level_requirement))
                  * ENERGY_PER_LEVEL * config.energy_gain_coefficient;

    return gain;
  }

  /**
   * @brief Разносит вклад по уровням, СПИСЫВАЯ требование каждого пройденного.
   *
   * Раньше начисление считалось один раз от требования стартового уровня, а
   * накопленная энергия делилась на сотню линейно: уровни росли так, будто
   * требование не меняется. Из-за этого один крупный вклад давал кратно больше
   * уровней, чем положено — при базе 10 000 ₽ и коэффициенте роста 1.5 взнос
   * в миллион поднимал на сотню уровней вместо десяти, и коэффициент роста
   * фактически не работал вовсе.
   *
   * Теперь вклад расходуется последовательно: сперва добирается текущий
   * уровень, затем каждый следующий по своему — уже большему — требованию.
   *
   * @param amount_minor Сумма вклада в минорных единицах (после коэффициента прироста)
   * @param start_level Уровень до начисления (нумерация с единицы)
   * @param start_energy Накопленная энергия на этом уровне (0..100)
   */
  inline LevelProgress apply_contribution_to_levels(double amount_minor, uint32_t start_level,
                                                    double start_energy, const Capital::config& config) {
    LevelProgress progress{start_level, start_energy};

    if (amount_minor <= 0.0) {
      return progress;
    }

    // Коэффициент прироста ускоряет набор — он масштабирует сам вклад, а не
    // требование уровня: иначе смена коэффициента переписывала бы шкалу.
    double remaining = amount_minor * config.energy_gain_coefficient;

    // Защита от вечного цикла на вырожденной конфигурации: без роста
    // требования и с нулевой базой уровни не считаются вовсе.
    if (config.level_depth_base == 0) {
      return progress;
    }

    // Верхняя граница на число переходов за один вклад: миллион уровней
    // недостижим при любом разумном коэффициенте роста, а цикл обязан
    // завершаться при любых входных данных.
    static const uint32_t kMaxLevelsPerContribution = 1000000;
    uint32_t steps = 0;

    while (steps < kMaxLevelsPerContribution) {
      const double requirement = static_cast<double>(calculate_level_requirement(progress.level, config));
      if (requirement <= 0.0) {
        break;
      }

      // Сколько минорных единиц осталось добрать до конца текущего уровня.
      const double needed = (ENERGY_PER_LEVEL - progress.energy) / ENERGY_PER_LEVEL * requirement;

      if (remaining < needed) {
        progress.energy += remaining / requirement * ENERGY_PER_LEVEL;
        return progress;
      }

      remaining -= needed;
      progress.level += 1;
      progress.energy = 0.0;
      steps += 1;
    }

    return progress;
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

  /**
   * @brief Начисляет вклад участнику, разнося его по уровням.
   *
   * Пришло на смену add_energy_and_check_levelup(energy_gain): та считала
   * начисление один раз от требования стартового уровня и делила накопленную
   * энергию на сотню линейно, из-за чего коэффициент роста не работал и один
   * крупный вклад давал кратно больше уровней, чем положено.
   *
   * @param amount_minor Сумма вклада в минорных единицах
   */
  inline void add_contribution_and_check_levelup(eosio::name coopname, uint64_t contributor_id, double amount_minor) {
    if (amount_minor <= 0.0) {
      return;
    }

    Capital::contributor_index contributors(_capital, coopname.value);
    auto contributor = contributors.find(contributor_id);

    eosio::check(contributor != contributors.end(), "Участник не найден");

    auto config = Capital::State::get_global_state(coopname).config;

    uint32_t prev_level = contributor->level;
    uint32_t new_level = 0;
    contributors.modify(contributor, _capital, [&](auto &c) {
      const LevelProgress progress = apply_contribution_to_levels(amount_minor, c.level, c.energy, config);

      c.level = progress.level;
      c.energy = progress.energy;
      c.last_energy_update = eosio::current_time_point();

      if (c.level > prev_level) {
        new_level = c.level;
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

    // Разносим вклад по уровням: требование каждого пройденного списывается
    // отдельно, поэтому коэффициент роста работает и на крупных суммах.
    (void)config;
    add_contribution_and_check_levelup(coopname, contributor_id, static_cast<double>(total_contribution.amount));
  }

} // namespace Capital::Gamification
