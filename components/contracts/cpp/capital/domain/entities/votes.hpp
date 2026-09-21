#pragma once


#include "../../../lib/core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

namespace Capital {

  /**
   * @brief Структура для передачи одного голоса в submitvote
   */
  struct vote_input {
      name recipient;    ///< За кого голосует
      asset amount;      ///< Сумма голоса
  };

  /**
    * @brief Рассчитывает суммы для распределения по пулам
  */
  struct voting_amounts {
      eosio::asset authors_equal_spread = asset(0, _root_govern_symbol);      ///< 62.8% авторских премий поровну
      eosio::asset creators_direct_spread = asset(0, _root_govern_symbol);    ///< 62.8% исполнительских премий каждому
      eosio::asset authors_bonuses_on_voting = asset(0, _root_govern_symbol); ///< 38.2% авторских премий на голосование
      eosio::asset creators_bonuses_on_voting = asset(0, _root_govern_symbol); ///< 38.2% исполнительских премий на голосование
      eosio::asset total_voting_pool = asset(0, _root_govern_symbol);         ///< Общая сумма для распределения по Водянову (авторы + создатели)
      eosio::asset active_voting_amount = asset(0, _root_govern_symbol);      ///< Общая голосующая сумма = total_voting_pool * (voters-1)/voters
      eosio::asset equal_voting_amount = asset(0, _root_govern_symbol);       ///< Средняя сумма на каждого участника (total_voting_pool / voters)
      eosio::asset authors_equal_per_author = asset(0, _root_govern_symbol);  ///< Равная сумма на каждого автора (62.8% / количество авторов)
  };
  
  /**
   * @brief Структура данных для голосования по методу Водянова
   */
  struct voting_data {
    uint32_t total_voters;                          ///< Общее количество участников
    uint32_t votes_received;                        ///< Количество полученных голосов
    
    double authors_voting_percent;                  ///< Процент премий авторов для голосования (по умолчанию; уточняется из config при инициализации голосования)
    double creators_voting_percent;                 ///< Процент премий создателей для голосования (по умолчанию; уточняется из config при инициализации голосования)
    
    voting_amounts amounts;                         ///< Суммы на голосовании
    
    time_point_sec voting_deadline;                 ///< Дедлайн голосования
  };

  /**
   * @brief Таблица голосов хранит информацию о голосах участников по методу Водянова.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): votes 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] vote {
    uint64_t id;                                    ///< ID голоса (внутренний ключ)
    name coopname;                                  ///< Кооператив
    checksum256 project_hash;                       ///< Хэш проекта
    name voter;                                     ///< Кто голосует  
    name recipient;                                 ///< За кого голосует
    asset amount;                                   ///< Сумма голоса
    time_point_sec voted_at;                        ///< Время голосования
    
    uint64_t primary_key() const { return id; }     ///< Первичный ключ (1)
    
    checksum256 by_project() const { return project_hash; } ///< Индекс по хэшу проекта (2)
    
    // Индекс по проекту и голосующему - для проверки что пользователь не голосовал дважды
    uint128_t by_project_voter() const {            ///< Индекс по проекту и голосующему (3)
        return combine_checksum_ids(project_hash, voter);
    }
    
    // Индекс по проекту и получателю - для подсчета сумм полученных голосов
    uint128_t by_project_recipient() const {        ///< Индекс по проекту и получателю (4)
        return combine_checksum_ids(project_hash, recipient);
    }
  };

typedef eosio::multi_index<"votes"_n, vote,
    indexed_by<"byproject"_n, const_mem_fun<vote, checksum256, &vote::by_project>>,
    indexed_by<"byprojvoter"_n, const_mem_fun<vote, uint128_t, &vote::by_project_voter>>,
    indexed_by<"byprojrecip"_n, const_mem_fun<vote, uint128_t, &vote::by_project_recipient>>
> votes_index;

namespace Votes {

    /**
     * @brief Проверяет голосовал ли пользователь в данном проекте
     */
    inline bool has_user_voted(name coopname, checksum256 project_hash, name voter) {
        votes_index votes(_capital, coopname.value);
        auto idx = votes.get_index<"byprojvoter"_n>();
        auto key = combine_checksum_ids(project_hash, voter);
        
        return idx.find(key) != idx.end();
    }

    /**
     * @brief Получает все голоса получателя в проекте
     */
    inline std::vector<vote> get_votes_for_recipient(name coopname, checksum256 project_hash, name recipient) {
        votes_index votes(_capital, coopname.value);
        auto idx = votes.get_index<"byprojrecip"_n>();
        auto key = combine_checksum_ids(project_hash, recipient);
        
        std::vector<vote> result;
        auto itr = idx.find(key);
        while (itr != idx.end() && itr->by_project_recipient() == key) {
            result.push_back(*itr);
            ++itr;
        }
        return result;
    }

    /**
     * @brief Добавляет голос в проект
     */
    inline void add_vote(name coopname, checksum256 project_hash, 
                        name voter, name recipient, asset amount) {
        votes_index votes(_capital, coopname.value);
        auto vote_id = get_global_id_in_scope(_capital, coopname, "vote"_n);
        
        votes.emplace(RamPayer::of(votes, coopname), [&](auto &v) {
            v.id = vote_id;
            v.coopname = coopname;
            v.project_hash = project_hash;
            v.voter = voter;
            v.recipient = recipient;
            v.amount = amount;
            v.voted_at = current_time_point();
        });
    }

} // namespace Votes

} // namespace Capital

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::vote, cooperative);
