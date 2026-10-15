#include "crps.hpp"

namespace Capital::Core {

  /**
  * @brief Создает или обновляет запись пропертора с имущественным взносом в таблице segments.
  * @param coopname Имя кооператива (scope таблицы).
  * @param segment_id ID сегмента.
  * @param project Проект.
  * @param username Имя пользователя.
  * @param property_amount Стоимость имущественного взноса.
  */
  void upsert_propertor_segment(eosio::name coopname, uint64_t segment_id, const Capital::project &project, 
                                        eosio::name username, const eosio::asset &property_amount) {
      Segments::segments_index segments(_capital, coopname.value);
      auto segment = segments.find(segment_id);

      if (segment == segments.end()) {
        segments.emplace(RamPayer::of(segments, coopname), [&](auto &g){
            g.id            = segment_id;
            g.coopname      = coopname;
            g.project_hash  = project.project_hash;
            g.username      = username;
            g.property_base = property_amount;
            // Участник с имущественным взносом становится пропертором
            g.is_propertor = true;
        });

          // Увеличиваем счетчики для нового участника
          Capital::Projects::increment_total_unique_participants(coopname, project.id);
          Capital::Projects::increment_total_propertors(coopname, project.id);
      
        } else {
          bool became_propertor = (!segment->is_propertor);
          
          segments.modify(segment, RamPayer::of(segments, coopname), [&](auto &g) {
              if (!g.is_propertor) {
                  g.is_propertor = true;
              }
              g.property_base += property_amount;
          });
          
          if (became_propertor) {
              Capital::Projects::increment_total_propertors(coopname, project.id);
          }
      }
      
      // Обновляем общую стоимость сегмента после добавления имущественного взноса
      Segments::update_segment_total_cost(coopname, segment_id, project);
  }
}// namespace Capital::Core
