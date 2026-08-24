#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>

using namespace eosio;

namespace Capital::Segments {
  /**
   * @brief Константы статусов сегмента
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    const eosio::name GENERATION = "generation"_n;         ///< На генерации результата
    const eosio::name READY = "ready"_n;                   ///< Проект завершен, ожидает внесения результата
    const eosio::name STATEMENT = "statement"_n;           ///< Сегмент на стадии взноса результата (заявление подано)
    const eosio::name APPROVED = "approved"_n;             ///< Результат одобрен председателем
    const eosio::name AUTHORIZED = "authorized"_n;         ///< Результат авторизован советом
    const eosio::name ACT1 = "act1"_n;                     ///< Первый акт подписан участником
    const eosio::name CONTRIBUTED = "contributed"_n;       ///< Результат внесён и принят (второй акт подписан)
    const eosio::name SKIPPED = "skipped"_n;       ///< Внесение результата пропущено за отсутствием интеллектуальной части
  }
  
  /**
   * @brief Таблица сегментов хранит данные о вкладах участника в проект.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): segments 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] segment {
    uint64_t id;                                          ///< ID сегмента (внутренний ключ)
    checksum256 project_hash;                             ///< Хэш проекта
    eosio::name coopname;                                 ///< Имя кооператива
    eosio::name username;                                 ///< Имя участника
    
    // Статус результата сегмента
    eosio::name status = Status::GENERATION;              ///< Статус сегмента: generation | ready | statement | approved | authorized | act1 | contributed

    // Роли участника в проекте
    bool is_author = false;                               ///< Является ли участник автором
    bool is_creator = false;                              ///< Является ли участник создателем  
    bool is_coordinator = false;                          ///< Является ли участник координатором
    bool is_investor = false;                             ///< Является ли участник инвестором
    bool is_propertor = false;                            ///< Является ли участник пропертором
    bool is_contributor = false;                          ///< Является ли участник участником
    bool has_vote = false;                                ///< Имеет ли участник право голоса
    
    /// Вклады
    // Основная информация о вкладе инвестора
    eosio::asset investor_amount = asset(0, _root_govern_symbol); ///< Полная сумма инвестиций, которую инвестор внес в проект
    eosio::asset investor_base = asset(0, _root_govern_symbol);   ///< Фактически используемая сумма инвестора при коэффициенте возврата > 1
    
    // Основная информация о вкладе создателя
    eosio::asset creator_base = asset(0, _root_govern_symbol);    ///< Сумма себестоимости, которую исполнитель фактически потратил на выполнение проекта
    eosio::asset creator_bonus = asset(0, _root_govern_symbol);   ///< Сумма бонусов, которую исполнитель получил за выполнение проекта
    
    // Основная информация о вкладе автора
    eosio::asset author_base = asset(0, _root_govern_symbol);     ///< Сумма себестоимости, которую автор фактически потратил на выполнение проекта
    eosio::asset author_bonus = asset(0, _root_govern_symbol);    ///< Сумма бонусов, которую автор получил за выполнение проекта
    
    // Основная информация о вкладе координатора
    eosio::asset coordinator_investments = asset(0, _root_govern_symbol); ///< Сумма инвестиций, которую координатор привлек в проект
    eosio::asset coordinator_base = asset(0, _root_govern_symbol);        ///< Сумма себестоимости, которую координатор фактически потратил на выполнение проекта
    
    // Основная информация о вкладе участника
    eosio::asset contributor_bonus = asset(0, _root_govern_symbol);       ///< Сумма бонусов, которую участник получил от проекта
    
    // Имущественные взносы
    eosio::asset property_base = asset(0, _root_govern_symbol);           ///< Стоимость внесенного имущества участника
      
    // CRPS поля для масштабируемого распределения наград
    double last_author_base_reward_per_share = 0.0;                       ///< Последняя зафиксированная базовая награда на долю для авторов  
    double last_author_bonus_reward_per_share = 0.0;                      ///< Последняя зафиксированная бонусная награда на долю для авторов
    double last_contributor_reward_per_share = 0.0;                       ///< Последняя зафиксированная награда на долю для участников

    // Доли в программе и проекте
    eosio::asset capital_contributor_shares = asset(0, _root_govern_symbol); ///< Количество долей участника в программе благороста
    
    // Последняя известная сумма инвестиций в проекте для расчета provisional_amount
    eosio::asset last_known_invest_pool = asset(0, _root_govern_symbol);     ///< Последняя известная сумма инвестиций в проекте
    
    // Последняя известная сумма базового пула создателей для расчета использования инвестиций
    eosio::asset last_known_creators_base_pool = asset(0, _root_govern_symbol); ///< Последняя известная сумма базового пула создателей
    
    // Последняя известная сумма инвестиций координаторов для отслеживания изменений
    eosio::asset last_known_coordinators_investment_pool = asset(0, _root_govern_symbol); ///< Последняя известная сумма инвестиций координаторов
    
    // Финансовые данные для ссуд
    eosio::asset provisional_amount = asset(0, _root_govern_symbol);       ///< Доступная сумма для залога при получении ссуды
    eosio::asset debt_amount = asset(0, _root_govern_symbol);              ///< Сумма, которая уже выдана в ссуду
    eosio::asset debt_settled = asset(0, _root_govern_symbol);             ///< Сумма погашенных ссуд
    
    // Пулы равных премий авторов и прямых премий создателей
    eosio::asset equal_author_bonus = asset(0, _root_govern_symbol);       ///< Сумма равных премий авторам
    eosio::asset direct_creator_bonus = asset(0, _root_govern_symbol);     ///< Сумма прямых премий создателю
    
    // Результаты голосования по методу Водянова
    bool is_votes_calculated = false;                                      ///< Флаг завершения расчета голосования
    eosio::asset voting_bonus = asset(0, _root_govern_symbol);             ///< Сумма от голосования авторского пула
    
    // Общая стоимость сегмента (рассчитывается автоматически)
    eosio::asset total_segment_base_cost = asset(0, _root_govern_symbol);  ///< Общая стоимость базовых вкладов сегмента
    eosio::asset total_segment_bonus_cost = asset(0, _root_govern_symbol); ///< Общая стоимость бонусных вкладов сегмента
    eosio::asset total_segment_cost = asset(0, _root_govern_symbol);       ///< Общая стоимость всех вкладов сегмента (включая investor_base)
    
    // Интеллектуальная стоимость сегмента и доля в результате
    eosio::asset intellectual_cost = asset(0, _root_govern_symbol);        ///< Стоимость интеллектуальных вкладов (total_segment_cost - investor_base)
    eosio::asset available_for_program = asset(0, _root_govern_symbol); ///< Доступная сумма для конвертации в программу (intellectual_cost - debt_amount)
    eosio::asset available_for_wallet = asset(0, _root_govern_symbol); ///< Доступная сумма для конвертации в кошелек (provisional_amount - debt_amount)
    double share_percent = 0.0;                                            ///< Доля участника в результате (intellectual_cost / fact.total * 100)

    // Допуск L2 — ставка часа, утверждённая мастером компонента через approverole.
    // createcmmt берёт её вместо личной ставки пайщика из contributors, если она задана.
    // binary_extension: таблица segments уже в продакшене, схема расширяется только хвостом.
    eosio::binary_extension<eosio::asset> approved_rate_per_hour;          ///< Утверждённая мастером ставка часа на этом сегменте
    eosio::binary_extension<uint64_t> approved_hours_per_day;              ///< Утверждённая мастером норма часов в день на этом сегменте

    // Сколько займов пайщика на этом проекте ещё не закрыто. Считается здесь,
    // чтобы при сдаче результата не перебирать все займы проекта — на большом
    // проекте такой перебор не укладывается в лимит транзакции.
    eosio::binary_extension<uint32_t> active_debts_count;                  ///< Число невозвращённых займов пайщика на этом проекте

    uint64_t primary_key() const { return id; }                           ///< Первичный ключ (1)
    
    checksum256 by_project_hash() const { return project_hash; }          ///< Индекс по хэшу проекта (2)
  
    // Индекс по (project_hash + username) - уникальный для каждого участника проекта
    uint128_t by_project_user() const {                                   ///< Индекс по проекту и пользователю (3)
        return combine_checksum_ids(project_hash, username);
    }
    
  };
  
  typedef eosio::multi_index<
    "segments"_n, segment,
    indexed_by<"byproject"_n, const_mem_fun<segment, checksum256, &segment::by_project_hash>>,
    indexed_by<"byprojuser"_n, const_mem_fun<segment, uint128_t, &segment::by_project_user>>
  > segments_index;

  
  inline std::optional<segment> get_segment(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
    segments_index segments(_capital, coopname.value);
    auto idx  = segments.get_index<"byprojuser"_n>();
    auto rkey = combine_checksum_ids(project_hash, username);

    auto it = idx.find(rkey);
    if (it == idx.end()) {
        return std::nullopt;
    }
    return segment(*it);
  }

  inline segment get_segment_or_fail(eosio::name coopname, const checksum256 &project_hash, eosio::name username, const char* msg) {
    auto maybe_segment = get_segment(coopname, project_hash, username);
    eosio::check(maybe_segment.has_value(), msg);
    return maybe_segment.value();
  }

  inline segment get_segment_by_id_or_fail(eosio::name coopname, uint64_t segment_id, const char* msg = "Сегмент не найден") {
    segments_index segments(_capital, coopname.value);
    auto segment_itr = segments.find(segment_id);
    eosio::check(segment_itr != segments.end(), msg);
    return segment(*segment_itr);
  }

  /**
   * @brief Фиксирует утверждённую мастером ставку часа и норму часов в день на сегменте.
   *
   * Вызывается из approverole / acceptinvite. Дальше createcmmt берёт эту ставку
   * для расчёта generation_amounts вместо личной ставки пайщика из contributors —
   * так мастер компонента дифференцирует ставку по проекту, не меняя договор УХД.
   *
   * Сегмент должен уже существовать: он создаётся при подписании приложения
   * договора УХД на этот проект через apprvappndx (допуск L1).
   */
  inline void set_approved_rate(
    eosio::name coopname,
    const checksum256 &project_hash,
    eosio::name username,
    const eosio::asset &rate_per_hour,
    uint64_t hours_per_day
  ) {
    segments_index segments(_capital, coopname.value);
    auto idx  = segments.get_index<"byprojuser"_n>();
    auto rkey = combine_checksum_ids(project_hash, username);
    auto it = idx.find(rkey);
    eosio::check(it != idx.end(), "Сегмент участника на этом проекте не найден");

    idx.modify(it, coopname, [&](auto &s) {
      s.approved_rate_per_hour.emplace(rate_per_hour);
      s.approved_hours_per_day.emplace(hours_per_day);
    });
  }


/**
 * @brief Подсчитывает количество авторов в проекте.
 * @param coopname Имя кооператива (scope таблицы).
 * @param project_hash Хэш проекта.
 * @return Количество авторов.
 */
inline uint64_t count_project_authors(eosio::name coopname, const checksum256 &project_hash) {
    segments_index segments(_capital, coopname.value);
    auto project_idx = segments.get_index<"byproject"_n>();
    
    // Собираем ID сначала, потом считаем
    std::vector<uint64_t> author_ids;
    {
        auto itr = project_idx.find(project_hash);
        while (itr != project_idx.end() && itr->project_hash == project_hash) {
            if (itr->is_author) {
                author_ids.push_back(itr->id); // Сохраняем ID, а не итератор
            }
            ++itr;
        }
    } // Итератор уничтожен
    
    return author_ids.size();
}



/**
 * @brief Проверяет является ли пользователь участником голосования
 * @param coopname Имя кооператива
 * @param project_hash Хэш проекта  
 * @param username Имя пользователя
 * @return true если у пользователя есть право голоса
 */
inline bool is_voting_participant(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
    auto segment = get_segment(coopname, project_hash, username);
    return segment.has_value() && segment->has_vote;
}

/**
 * @brief Проверяет является ли участник чистым инвестором (только инвестор, без других интеллектуальных ролей)
 * @param segment Сегмент участника
 * @return true если участник только инвестор
 */
inline bool is_pure_investor(const segment& seg) {
    return seg.is_investor && 
           !seg.is_author && 
           !seg.is_creator && 
           !seg.is_coordinator && 
           !seg.is_propertor;
}

/**
 * @brief Проверяет имеет ли участник роли, требующие внесения интеллектуального результата
 * @param segment Сегмент участника
 * @return true если у участника есть интеллектуальные роли
 */
inline bool has_intellectual_contribution_roles(const segment& seg) {
    return seg.is_author || 
           seg.is_creator || 
           seg.is_coordinator || 
           seg.is_propertor || 
           seg.is_contributor;
}

/**
 * @brief Рассчитывает сумму неинвестиционных вкладов сегмента (для внесения результата)
 * @param segment Сегмент участника
 * @return Сумма вкладов, которую нужно внести как результат (без инвестиционной части)
 */
inline eosio::asset calculate_non_investor_contribution(const segment& seg) {
    // Базовые вклады (без investor_base, так как он уже внесен при инвестировании)
    eosio::asset base_contribution = seg.creator_base + seg.author_base + seg.coordinator_base + seg.property_base;
    
    // Бонусы (премии) только для интеллектуальных ролей
    eosio::asset bonus_contribution = seg.creator_bonus + seg.author_bonus + 
                                     seg.equal_author_bonus + seg.direct_creator_bonus + 
                                     seg.voting_bonus + seg.contributor_bonus;
    
    return base_contribution + bonus_contribution;
}

/**
 * @brief Рассчитывает базовую стоимость сегмента
 * @param segment Сегмент для расчёта
 * @return Базовая стоимость сегмента
 */
inline eosio::asset calculate_segment_base_cost(const segment& seg) {
    eosio::asset total = asset(0, _root_govern_symbol);
    
    // Базовые вклады (всегда учитываются)
    total += seg.investor_base; // фактически используемая сумма инвестора
    total += seg.creator_base;
    total += seg.author_base;
    total += seg.coordinator_base;
    total += seg.property_base; // стоимость внесенного имущества
    
    return total;
}

/**
 * @brief Рассчитывает бонусную стоимость сегмента
 * @param segment Сегмент для расчёта
 * @param project Проект для определения, прошло ли голосование
 * @return Бонусная стоимость сегмента
 */
inline eosio::asset calculate_segment_bonus_cost(const segment& seg, const Capital::project& project) {
    eosio::asset total = asset(0, _root_govern_symbol);
    
    // Премии зависят от статуса проекта
    if (project.status == Capital::Projects::Status::RESULT) {
        // После голосования используем результаты голосования
        total += seg.equal_author_bonus;
        total += seg.direct_creator_bonus;
        total += seg.voting_bonus;
    } else {
        // До голосования используем полные суммы премий
        total += seg.creator_bonus;
        total += seg.author_bonus;
    }
    
    // Премии участников
    total += seg.contributor_bonus;
    
    return total;
}

/**
 * @brief Обновляет все стоимости сегмента (базовые, бонусные и общую)
 */
inline void update_segment_total_cost(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
    segments_index segments(_capital, coopname.value);
    auto segment = segments.find(segment_id);
    
    eosio::check(segment != segments.end(), "Сегмент участника не найден");
    
    segments.modify(segment, coopname, [&](auto &s) {
        s.total_segment_base_cost = calculate_segment_base_cost(s);
        s.total_segment_bonus_cost = calculate_segment_bonus_cost(s, project);
        s.total_segment_cost = s.total_segment_base_cost + s.total_segment_bonus_cost;
        
        eosio::check(s.total_segment_cost >= s.investor_base, "Сумма всех вкладов сегмента должна быть больше или равна сумме инвестиций инвестора");
        
        // Интеллектуальная стоимость = полная стоимость минус обеспечительный взнос инвестора
        s.intellectual_cost = s.total_segment_cost - s.investor_base;
        
        eosio::check(s.intellectual_cost >= s.debt_amount, "Интеллектуальная стоимость должна быть больше или равна сумме выданных ссуд");
        // Доступная сумма для конвертации в программу
        s.available_for_program = s.intellectual_cost - s.debt_amount;
        
        eosio::check(s.provisional_amount >= s.debt_amount, "Доступная сумма для конвертации в кошелек должна быть больше или равна сумме выданных ссуд");
        // Доступная сумма для конвертации в кошелек
        s.available_for_wallet = s.provisional_amount - s.debt_amount;

        // Доля участника в результате интеллектуальной деятельности
        if (project.fact.total.amount > 0) {
            s.share_percent = (static_cast<double>(s.intellectual_cost.amount) / 
                              static_cast<double>(project.fact.total.amount)) * 100.0;
        } else {
            s.share_percent = 0.0;
        }
    });
}

  /**
   * @brief Обновляет статус результата в сегменте
   */
  inline void update_segment_status(eosio::name coopname, const checksum256 &project_hash, 
                                        eosio::name username, eosio::name new_status) {
    segments_index segments(_capital, coopname.value);
    auto idx = segments.get_index<"byprojuser"_n>();
    auto key = combine_checksum_ids(project_hash, username);
    auto segment_itr = idx.find(key);
    
    eosio::check(segment_itr != idx.end(), "Сегмент участника не найден");
    
    idx.modify(segment_itr, _capital, [&](auto &s) {
        s.status = new_status;
    });
}

/**
 * @brief Объединенная функция: обновляет сегмент после принятия результата и пересчитывает доли участника
 * Оптимизированная версия для избежания двойного обновления одной записи
 */
inline void update_segment_after_result_contribution(eosio::name coopname, const checksum256 &project_hash, 
                                                               eosio::name username,
                                                               eosio::asset debt_settled_amount = asset(0, _root_govern_symbol)) {
    segments_index segments(_capital, coopname.value);
    auto idx = segments.get_index<"byprojuser"_n>();
    auto key = combine_checksum_ids(project_hash, username);
    auto segment_itr = idx.find(key);
    
    eosio::check(segment_itr != idx.end(), "Сегмент участника не найден");
    
    idx.modify(segment_itr, coopname, [&](auto &s) {
        // Обновляем после принятия результата
        s.status = Capital::Segments::Status::STATEMENT;
        
        // Если есть погашение долга, отмечаем его
        if (debt_settled_amount.amount > 0) {
            s.debt_settled += debt_settled_amount;
        }
    });
}


inline uint64_t get_segment_id(eosio::name coopname) {
  return get_global_id_in_scope(_capital, coopname, "segments"_n);
}

/**
 * @brief Обновляет сегмент участника результатами голосования и премиями
 */
inline void update_segment_voting_results(eosio::name coopname, const Capital::project &project, 
                                         const segment &segment,
                                         eosio::name username,
                                         eosio::asset voting_amount,
                                         eosio::asset equal_author_amount,
                                         eosio::asset direct_creator_amount) {
    segments_index segments(_capital, coopname.value);
    auto segment_itr = segments.find(segment.id);
    
    eosio::check(segment_itr != segments.end(), "Сегмент участника не найден");
    
    segments.modify(segment_itr, coopname, [&](auto &s) {
        s.voting_bonus = voting_amount;
        s.equal_author_bonus = equal_author_amount;
        s.direct_creator_bonus = direct_creator_amount;
        s.is_votes_calculated = true;
    });
    
    // Обновляем общую стоимость сегмента после изменения премий
    update_segment_total_cost(coopname, segment_itr->id, project);
}

inline void set_investor_base_amount_on_return_unused(eosio::name coopname, uint64_t segment_id, eosio::asset used_amount) {
  Capital::Segments::segments_index segments(_capital, coopname.value);
  auto segment_itr = segments.find(segment_id);

  segments.modify(segment_itr, coopname, [&](auto &s) {
    // Обновляем общую сумму инвестора до фактически использованной
    s.investor_amount = used_amount;
    // Также обновляем фактически используемую сумму инвестора для корректного расчета total_segment_cost
    s.investor_base = used_amount;
  });

}

inline void increase_debt_amount(eosio::name coopname, uint64_t segment_id, eosio::asset amount) {
  Capital::Segments::segments_index segments(_capital, coopname.value);
  auto segment = segments.find(segment_id);
  
  segments.modify(segment, coopname, [&](auto &s) {
      s.debt_amount += amount;
  });
}
  
inline void decrease_debt_amount(eosio::name coopname, uint64_t segment_id, eosio::asset amount) {
  Capital::Segments::segments_index segments(_capital, coopname.value);
  auto segment = segments.find(segment_id);
  
  eosio::check(segment->debt_amount >= amount, "Пайщик не может погасить долг больше, чем должен");
  
  segments.modify(segment, coopname, [&](auto &s) {
    s.debt_amount -= amount;
  });
}

/**
 * @brief Отмечает, что у пайщика на этом проекте стало одним невозвращённым займом больше.
 */
inline void increase_active_debts_count(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
  segments_index segments(_capital, coopname.value);
  auto idx = segments.get_index<"byprojuser"_n>();
  auto rkey = combine_checksum_ids(project_hash, username);
  auto it = idx.find(rkey);
  eosio::check(it != idx.end(), "Сегмент участника на этом проекте не найден");
  idx.modify(it, coopname, [&](auto &s) {
    uint32_t current = s.active_debts_count.has_value() ? *s.active_debts_count : 0;
    s.active_debts_count.emplace(current + 1);
  });
}

/**
 * @brief Отмечает, что заём пайщика на этом проекте закрыт — возвратом или списанием.
 */
inline void decrease_active_debts_count(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
  segments_index segments(_capital, coopname.value);
  auto idx = segments.get_index<"byprojuser"_n>();
  auto rkey = combine_checksum_ids(project_hash, username);
  auto it = idx.find(rkey);
  eosio::check(it != idx.end(), "Сегмент участника на этом проекте не найден");
  idx.modify(it, coopname, [&](auto &s) {
    uint32_t current = s.active_debts_count.has_value() ? *s.active_debts_count : 0;
    eosio::check(current > 0, "Незакрытых займов на этом проекте не числится");
    s.active_debts_count.emplace(current - 1);
  });
}

/**
 * @brief Сколько займов пайщика на этом проекте ещё не закрыто.
 */
inline uint32_t get_active_debts_count(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
  auto segment = get_segment(coopname, project_hash, username);
  if (!segment.has_value()) return 0;
  return segment->active_debts_count.has_value() ? *segment->active_debts_count : 0;
}

/**
 * @brief Удаляет сегмент участника
 * @param coopname Имя кооператива
 * @param segment_id ID сегмента
 */
inline void remove_segment(eosio::name coopname, uint64_t segment_id) {
  segments_index segments(_capital, coopname.value);
  auto segment = segments.find(segment_id);
  
  eosio::check(segment != segments.end(), "Сегмент участника не найден");
  
  segments.erase(segment);

}

/**
 * @brief Удаляет все сегменты участников проекта (по secondary index byproject)
 * @param coopname Имя кооператива
 * @param project_hash Хэш проекта
 */
inline void remove_all_project_segments(eosio::name coopname, const checksum256 &project_hash) {
  segments_index segments(_capital, coopname.value);
  auto project_idx = segments.get_index<"byproject"_n>();
  std::vector<uint64_t> ids;
  {
    auto itr = project_idx.find(project_hash);
    while (itr != project_idx.end() && itr->project_hash == project_hash) {
      ids.push_back(itr->id);
      ++itr;
    }
  }
  for (uint64_t id : ids) {
    remove_segment(coopname, id);
  }
}

/**
 * @brief Создает сегмент автора для проекта
 * @param coopname Имя кооператива
 * @param username Имя пользователя (автора)
 * @param project Объект проекта для инициализации CRPS полей
 */
inline void create_author_segment(eosio::name coopname, eosio::name username,  const Capital::project &project) {
  segments_index segments(_capital, coopname.value);

  segments.emplace(_capital, [&](auto &g){
    g.id            = get_global_id_in_scope(_capital, coopname, "segments"_n);
    g.coopname      = coopname;
    g.project_hash  = project.project_hash;
    g.username      = username;
    g.is_author     = true;
    g.has_vote      = true;
    // Инициализируем CRPS поля
    g.last_author_base_reward_per_share = project.crps.author_base_cumulative_reward_per_share;
    g.last_author_bonus_reward_per_share = project.crps.author_bonus_cumulative_reward_per_share;
  });
}

/**
 * @brief Обновляет сегмент, устанавливая статус автора
 * @param coopname Имя кооператива
 * @param segment_id ID сегмента
 * @param project Объект проекта для инициализации CRPS полей
 */
inline void update_segment_author_status(eosio::name coopname, uint64_t segment_id, const Capital::project &project) {
  segments_index segments(_capital, coopname.value);
  auto segment = segments.find(segment_id);

  eosio::check(segment != segments.end(), "Сегмент участника не найден");

  segments.modify(segment, coopname, [&](auto &g) {
    if (!g.is_author) {
      g.is_author = true;
      // Инициализируем CRPS поля для нового автора
      g.last_author_base_reward_per_share = project.crps.author_base_cumulative_reward_per_share;
      g.last_author_bonus_reward_per_share = project.crps.author_bonus_cumulative_reward_per_share;
    }
  });
}

/**
 * @brief Проверяет наличие сегментов в проекте
 * @param coopname Имя кооператива
 * @param project_hash Хэш проекта
 * @return true если есть сегменты, false если нет
 */
inline bool has_project_segments(eosio::name coopname, const checksum256 &project_hash) {
  segments_index segments(_capital, coopname.value);
  auto idx = segments.get_index<"byproject"_n>();
  auto it = idx.lower_bound(project_hash);

  return it != idx.end() && it->project_hash == project_hash;
}

} // namespace Capital::Segments

