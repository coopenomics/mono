#include "crps.hpp"

namespace Capital::Core {

  /**
  * @brief Создает или обновляет запись генератора для создателя в таблице segments.
  * @param coopname Имя кооператива (scope таблицы).
  * @param segment_id ID сегмента.
  * @param project Проект.
  * @param username Имя пользователя создателя.
  * @param delta_amounts Изменения сумм для создателя.
  */
  void upsert_creator_segment(eosio::name coopname, uint64_t segment_id, const Capital::project &project, 
                                        eosio::name username, const generation_amounts &delta_amounts) {
      Segments::segments_index segments(_capital, coopname.value);
      auto segment = segments.find(segment_id);
      
      if (segment == segments.end()) {
          segments.emplace(RamPayer::of(segments, coopname), [&](auto &g){
              g.id            = segment_id;
              g.coopname      = coopname;
              g.project_hash  = project.project_hash;
              g.username      = username;
              g.creator_base = delta_amounts.creators_base_pool;
              g.creator_bonus = delta_amounts.creators_bonus_pool;
              g.is_creator = true;
              // has_vote будет установлен через update_voting_status
          });

          // Увеличиваем счетчики для нового участника
          Capital::Projects::increment_total_unique_participants(coopname, project.id);
          Capital::Projects::increment_total_creators(coopname, project.id);
          
          // Обновляем статус голосования для нового создателя
          Capital::Core::Voting::update_voting_status(coopname, segment_id, project.id);
      
        } else {
          bool became_creator = (!segment->is_creator);
          
          segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &g) {
              if (!g.is_creator) {
                  g.is_creator = true;
              }
              g.creator_base += delta_amounts.creators_base_pool;
              g.creator_bonus += delta_amounts.creators_bonus_pool;
          });
          
          if (became_creator) {
              Capital::Projects::increment_total_creators(coopname, project.id);
          }
          
          // Всегда обновляем статус голосования после изменения ролей
          Capital::Core::Voting::update_voting_status(coopname, segment_id, project.id);
      }

      // Обновляем общую стоимость сегмента после изменения creator_base/creator_bonus
      Segments::update_segment_total_cost(coopname, segment_id, project);
  }
}// namespace Capital::Core