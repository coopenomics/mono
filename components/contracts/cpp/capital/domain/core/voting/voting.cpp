#include "voting.hpp"
#include "../../entities/votes.hpp"
#include "../../entities/segments.hpp"
#include "../../entities/projects.hpp"
#include <algorithm>
#include <limits>

namespace Capital::Core::Voting {

    void initialize_project_voting(name coopname, uint64_t project_id) {
      // Устанавливаем параметры голосования из конфигурации
      Capital::project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");

      auto st = Capital::State::get_global_state(coopname);

      auto amounts = calculate_voting_amounts(
        project -> fact.authors_bonus_pool,
        project -> fact.creators_bonus_pool,
        project -> counts.total_authors,
        project -> voting.total_voters,
        st.config.authors_voting_percent,
        st.config.creators_voting_percent
      );
    
      projects.modify(project, coopname, [&](auto &p) {
          p.voting.authors_voting_percent = st.config.authors_voting_percent;
          p.voting.creators_voting_percent = st.config.creators_voting_percent;
          p.voting.voting_deadline = time_point_sec(current_time_point().sec_since_epoch() + st.config.voting_period_in_days * 86400);
          p.voting.amounts = amounts;
      });
        
    }

    voting_amounts calculate_voting_amounts(const eosio::asset& authors_bonus_pool,
                                       const eosio::asset& creators_bonus_pool,
                                       uint64_t total_authors,
                                       uint32_t total_voters,
                                       double authors_voting_percent,
                                       double creators_voting_percent) {
    voting_amounts result;
    print("1");
    // Безопасный расчет коэффициентов с валидацией диапазона
    double authors_voting_pct = std::max(0.0, std::min(100.0, authors_voting_percent));
    double creators_voting_pct = std::max(0.0, std::min(100.0, creators_voting_percent));
    print("2");
    double authors_equal_percent = (100.0 - authors_voting_pct) / 100.0;
    double creators_direct_percent = (100.0 - creators_voting_pct) / 100.0;
    double authors_voting_coeff = authors_voting_pct / 100.0;
    double creators_voting_coeff = creators_voting_pct / 100.0;
    print("3");
    // Безопасное вычисление авторских премий
    double authors_equal_amount = static_cast<double>(authors_bonus_pool.amount) * authors_equal_percent;
    double authors_voting_amount = static_cast<double>(authors_bonus_pool.amount) * authors_voting_coeff;
    print("4");
    eosio::check(authors_equal_amount >= 0.0 && authors_equal_amount <= static_cast<double>(INT64_MAX),
                "Превышение лимита расчета равных премий авторов");
    eosio::check(authors_voting_amount >= 0.0 && authors_voting_amount <= static_cast<double>(INT64_MAX),
                "Превышение лимита расчета премий авторов на голосовании");
    print("5");
    result.authors_equal_spread = eosio::asset(
        static_cast<int64_t>(authors_equal_amount),
        authors_bonus_pool.symbol
    );
    result.authors_bonuses_on_voting = eosio::asset(
        static_cast<int64_t>(authors_voting_amount),
        authors_bonus_pool.symbol
    );
    print("6");
    if (total_authors > 0) {
        result.authors_equal_per_author = eosio::asset(
            result.authors_equal_spread.amount / total_authors,
            result.authors_equal_spread.symbol
        );
    } else {
        result.authors_equal_per_author = eosio::asset(0, authors_bonus_pool.symbol);
    }
    print("7");
    // Безопасное вычисление исполнительских премий
    double creators_direct_amount = static_cast<double>(creators_bonus_pool.amount) * creators_direct_percent;
    double creators_voting_amount = static_cast<double>(creators_bonus_pool.amount) * creators_voting_coeff;
    print("8");
    eosio::check(creators_direct_amount >= 0.0 && creators_direct_amount <= static_cast<double>(INT64_MAX),
                "Превышение лимита расчета прямых премий создателей");
    eosio::check(creators_voting_amount >= 0.0 && creators_voting_amount <= static_cast<double>(INT64_MAX),
                "Превышение лимита расчета премий создателей на голосовании");
    print("9");
    result.creators_direct_spread = eosio::asset(
        static_cast<int64_t>(creators_direct_amount),
        creators_bonus_pool.symbol
    );
    result.creators_bonuses_on_voting = eosio::asset(
        static_cast<int64_t>(creators_voting_amount),
        creators_bonus_pool.symbol
    );
    print("10");
    // Общий пул для голосования
    result.total_voting_pool = result.authors_bonuses_on_voting + result.creators_bonuses_on_voting;
    print("11: total_voters: ", total_voters);
    // Активная голосующая сумма
    result.active_voting_amount = eosio::asset(
        int64_t(static_cast<double>(result.total_voting_pool.amount) * (total_voters - 1) / total_voters),
        result.total_voting_pool.symbol
    );
    print("12");
    // Равная сумма на каждого — остаток пула после активной части.
    //
    // Считать её независимым делением P/N нельзя: submitvote требует
    // active + equal == total_voting_pool, а два независимых округления вниз
    // этот инвариант не держат. Прежняя «корректировка хвостика» добавляла к
    // equal весь остаток P mod N, из-за чего при остатке >= 2 сумма выходила
    // больше пула и голосование по проекту становилось невозможным вовсе
    // (проект «Системный логотип v1»: 5419.2213 + 2709.6108 = 8128.8321 при
    // пуле 8128.8320). Вычитание из пула делает инвариант тождественным при
    // любом остатке; при остатке 0 и 1 значение совпадает с прежним.
    result.equal_voting_amount = result.total_voting_pool - result.active_voting_amount;
    print("13");
    return result;
  }


    eosio::asset calculate_voting_final_amount(name coopname, checksum256 project_hash, name participant) {
        auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);
        
        // Получаем сегмент участника для определения его ролей
        auto segment = Capital::Segments::get_segment_or_fail(coopname, project_hash, participant, "Сегмент участника не найден");
        
        // Получаем все голоса за данного участника от других участников
        auto votes = Capital::Votes::get_votes_for_recipient(coopname, project_hash, participant);
        
        // Рассчитываем общую сумму голосов от других участников
        eosio::asset total_votes_received = asset(0, project.voting.amounts.total_voting_pool.symbol);
        for (const auto& vote : votes) {
            total_votes_received += vote.amount;
        }

        // Формула: (сумма всех полученных голосов + средняя сумма на каждого) / общее количество голосующих
        eosio::asset total_sum = (total_votes_received + project.voting.amounts.equal_voting_amount) / project.voting.total_voters;
        
        // Итоговая сумма от голосования по Водянову
        return total_sum;
    }

    eosio::asset calculate_equal_author_bonus(const Capital::project& project, const Capital::Segments::segment& segment) {
        // Если участник является автором, возвращаем равную премию
        if (segment.is_author) {
            return project.voting.amounts.authors_equal_per_author;
        }
        return asset(0, project.voting.amounts.authors_equal_per_author.symbol);
    }

    eosio::asset calculate_direct_creator_bonus(const Capital::project& project, const Capital::Segments::segment& segment) {
        // Если участник является создателем, рассчитываем прямую премию
        if (segment.is_creator) {
            // Безопасный расчет процента прямого распределения (не на голосование)
            // creators_voting_percent ограничен диапазоном [0, 100] валидацией конфига
            double voting_percent = std::max(0.0, std::min(100.0, project.voting.creators_voting_percent));
            double direct_percent = (100.0 - voting_percent) / 100.0;

            // Проверяем на переполнение перед преобразованием
            double bonus_amount = static_cast<double>(segment.creator_bonus.amount) * direct_percent;
            eosio::check(bonus_amount >= 0.0 && bonus_amount <= static_cast<double>(INT64_MAX),
                        "Превышение лимита расчета премии создателя");

            return eosio::asset(
                static_cast<int64_t>(bonus_amount),
                segment.creator_bonus.symbol
            );
        }
        return asset(0, segment.creator_bonus.symbol);
    }

    bool is_voting_completed(const Capital::project& project) {
        bool deadline_passed = current_time_point().sec_since_epoch() > project.voting.voting_deadline.sec_since_epoch();
        bool someone_voted = project.voting.votes_received > 0;
        bool all_voted = project.voting.total_voters > 0 && project.voting.votes_received >= project.voting.total_voters;
        
        // Досрочное завершение: все проголосовали
        if (all_voted) {
            return true;
        }
        
        // Завершение по дедлайну: дедлайн истек И хотя бы кто-то проголосовал
        return deadline_passed && someone_voted;
    }

    /**
     * @brief Обновляет статус сегмента участника, предоставляя ему право голоса, если это необходимо
     * @param coopname Имя кооператива
     * @param segment_id ID сегмента
     * @param project_id ID проекта
     */
    void update_voting_status(eosio::name coopname, uint64_t segment_id, uint64_t project_id) {
        Capital::Segments::segments_index segments(_capital, coopname.value);
        auto segment = segments.find(segment_id);

        if (segment == segments.end()) {
            return; // Сегмент не найден
        }
        
        bool had_vote_before = segment->has_vote;
        bool should_have_vote = segment->is_author || segment->is_creator;

        // Обновляем статус голосования только если участник получил право голоса
        if (!had_vote_before && should_have_vote) {
            segments.modify(segment, _capital, [&](auto &s) {
                s.has_vote = true;
            });
            
            Capital::Projects::increment_total_voters(coopname, project_id);
        }
    }

} // namespace Capital::Core