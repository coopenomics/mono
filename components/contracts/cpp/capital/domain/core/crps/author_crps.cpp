#include "crps.hpp"
  
namespace Capital::Core {
    
  /**
  * @brief Создает или обновляет запись генератора для автора в таблице segments.
  * @param coopname Имя кооператива (scope таблицы).
  * @param segment_id ID сегмента.
  * @param project Проект.
  * @param username Имя пользователя автора.
  */
  void upsert_author_segment(eosio::name coopname, uint64_t segment_id, const Capital::project &project, 
                                      eosio::name username) {
    
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    
    if (segment == segments.end()) {
        // Создаем сегмент автора с переданным ID
        segments.emplace(RamPayer::of(segments, coopname), [&](auto &g){
            g.id            = segment_id;
            g.coopname      = coopname;
            g.project_hash  = project.project_hash;
            g.username      = username;
            g.is_author     = true;
            // has_vote будет установлен через update_voting_status
            // Инициализируем CRPS поля
            g.last_author_base_reward_per_share = project.crps.author_base_cumulative_reward_per_share;
            g.last_author_bonus_reward_per_share = project.crps.author_bonus_cumulative_reward_per_share;
        });

        // Увеличиваем счетчики для нового участника
        Capital::Projects::increment_total_unique_participants(coopname, project.id);
        
        // Увеличиваем количество авторов в проекте
        Capital::Projects::increment_total_authors(coopname, project.id);
        
        // Обновляем статус голосования для нового автора
        Capital::Core::Voting::update_voting_status(coopname, segment_id, project.id);
        
    } else {
        bool became_author = (!segment->is_author);

        // Обновляем сегмент автора
        segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &g) {
            if (!g.is_author) {
                g.is_author = true;
                // Инициализируем CRPS поля для нового автора
                g.last_author_base_reward_per_share = project.crps.author_base_cumulative_reward_per_share;
                g.last_author_bonus_reward_per_share = project.crps.author_bonus_cumulative_reward_per_share;
            }
        });

        if (became_author) {
            Capital::Projects::increment_total_authors(coopname, project.id);
        }
        
        // Всегда обновляем статус голосования после изменения ролей
        Capital::Core::Voting::update_voting_status(coopname, segment_id, project.id);
    }
    
  }
  
  /**
   * @brief Обновляет награды автора в сегменте
   */
  void refresh_author_segment(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
    Segments::segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    
    if (segment == segments.end()) {
      return; // Сегмент не найден
    }
    
    segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &s) {
      if (s.is_author) {

        // Обновляем базовые авторские награды
        double base_delta = project.crps.author_base_cumulative_reward_per_share - s.last_author_base_reward_per_share;
        if (base_delta > 0.0) {
          uint128_t delta_128 = static_cast<uint128_t>(base_delta);
          int64_t pending_base_reward = static_cast<int64_t>(delta_128 / CRPS_PRECISION_FACTOR);

          if (pending_base_reward > 0) {
            s.author_base += eosio::asset(pending_base_reward, _root_govern_symbol);
            s.last_author_base_reward_per_share = project.crps.author_base_cumulative_reward_per_share;
          }
        }
        
        // Обновляем бонусные авторские награды
        double bonus_delta = project.crps.author_bonus_cumulative_reward_per_share - s.last_author_bonus_reward_per_share;
        if (bonus_delta > 0.0) {
          uint128_t delta_128 = static_cast<uint128_t>(bonus_delta);
          int64_t pending_bonus_reward = static_cast<int64_t>(delta_128 / CRPS_PRECISION_FACTOR);

          if (pending_bonus_reward > 0) {
            s.author_bonus += eosio::asset(pending_bonus_reward, _root_govern_symbol);
            s.last_author_bonus_reward_per_share = project.crps.author_bonus_cumulative_reward_per_share;
          }
        }        
      }
    });
    
  }
  
  /**
  * @brief Обновляет CRPS поля в проекте для авторов при добавлении наград
  * Примечание: для авторов CRPS хранит полную сумму награды на автора (не масштабированную),
  * так как количество авторов всегда небольшое число
  */
  void increment_authors_crps_in_project(eosio::name coopname, uint64_t project_id,
                         const eosio::asset &base_reward, const eosio::asset &bonus_reward) {
    Capital::project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);

    projects.modify(project_for_modify, RamPayer::of(projects, coopname), [&](auto &p) {
      if (p.counts.total_authors > 0) {
        uint128_t authors_count_128 = static_cast<uint128_t>(p.counts.total_authors);
        
        // Обновляем базовые авторские награды
        if (base_reward.amount > 0) {
          uint128_t base_128 = static_cast<uint128_t>(base_reward.amount);
          uint128_t base_per_author_scaled = (base_128 * CRPS_PRECISION_FACTOR) / authors_count_128;
          p.crps.author_base_cumulative_reward_per_share += static_cast<double>(base_per_author_scaled);
        }
        
        // Обновляем бонусные авторские награды
        if (bonus_reward.amount > 0) {
          uint128_t bonus_128 = static_cast<uint128_t>(bonus_reward.amount);
          uint128_t bonus_per_author_scaled = (bonus_128 * CRPS_PRECISION_FACTOR) / authors_count_128;
          p.crps.author_bonus_cumulative_reward_per_share += static_cast<double>(bonus_per_author_scaled);
        }
      }
    });
  }



}// namespace Capital::Core
