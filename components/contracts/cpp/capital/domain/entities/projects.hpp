#pragma once

#include "plan_pool.hpp"
#include "fact_pool.hpp" 
#include "crps.hpp"
#include "generation_amounts.hpp"
#include "votes.hpp"
#include "counts.hpp"
#include "global_state.hpp"

using namespace eosio;
using std::string;

namespace Capital::Projects {
  /**
  * @brief Константы статусов проекта
  * @ingroup public_consts
  * @ingroup public_capital_consts

  */
  namespace Status {
    const eosio::name PENDING = "pending"_n;     ///< Проект создан
    const eosio::name ACTIVE = "active"_n;       ///< Проект активен для коммитов
    const eosio::name VOTING = "voting"_n;       ///< Проект на голосовании
    const eosio::name RESULT = "result"_n;        ///< Проект завершен
    const eosio::name FINALIZED = "finalized"_n;  ///< Проект финализирован (все конвертации завершены, неиспользованные средства возвращены)
    const eosio::name CANCELLED = "cancelled"_n;  ///< Проект отменен
  }// namespace Capital::Projects::Status
}// namespace Capital::Projects

namespace Capital {
/**
* @brief Таблица проектов хранит информацию о проектах кооператива, которые станут результатами.
* @ingroup public_tables
* @ingroup public_capital_tables

* @par Область памяти (scope): coopname
* @par Имя таблицы (table): projects 
*/
struct [[eosio::table, eosio::contract(CAPITAL)]] project {
  uint64_t id; ///< ID проекта (внутренний ключ)
  
  name coopname; ///< Имя кооператива
  checksum256 project_hash; ///< Хэш проекта (внешний ключ)
  checksum256 parent_hash; ///< Хэш родительского проекта (если есть)
  
  eosio::name status; ///< Статус проекта

  bool is_opened; ///< Открыт ли проект для инвестиций
  bool is_planed; ///< Запланирован ли проект (установлен план)
  bool is_authorized; ///< Авторизован ли проект советом

  // Мастер проекта
  name master; ///< Мастер проекта
  
  std::string title; ///< Название проекта
  std::string description; ///< Описание проекта
  std::string invite; ///< Приглашение к проекту
  std::string data; ///< Шаблон/данные проекта
  std::string meta; ///< Метаданные проекта

  document2 authorization; ///< Документ авторизации совета

  counts_data counts; ///< Счетчики участников проекта
  
  plan_pool plan; ///< Плановые показатели
  fact_pool fact; ///< Фактические показатели
  crps_data crps; ///< Данные CRPS для распределения наград
  
  // Голосование по методу Водянова
  voting_data voting; ///< Данные голосования по методу Водянова
  
  // Время создания проекта
  time_point_sec created_at = current_time_point(); ///< Время создания проекта
  
  uint64_t primary_key() const { return id; } ///< Первичный ключ (1)
  uint64_t by_created_at() const { return created_at.sec_since_epoch(); } ///< Индекс по времени создания (2)
  checksum256 by_hash() const { return project_hash; } ///< Индекс по хэшу проекта (3)
  checksum256 by_parent_hash() const { return parent_hash; } ///< Индекс по хэшу родительского проекта (4)
};

typedef eosio::multi_index<"projects"_n, project,
  indexed_by<"bycreatedat"_n, const_mem_fun<project, uint64_t, &project::by_created_at>>,
  indexed_by<"byhash"_n, const_mem_fun<project, checksum256, &project::by_hash>>,
  indexed_by<"byparenthash"_n, const_mem_fun<project, checksum256, &project::by_parent_hash>>
> project_index;

}// namespace Capital

namespace Capital::Projects {
  /**
   * @brief Получает проект по хэшу
   * 
   * @param coopname Имя кооператива
   * @param project_hash Хэш проекта
   * @return Опциональный проект
   */
  inline std::optional<project> get_project(eosio::name coopname, const checksum256 &project_hash) {
    project_index projects(_capital, coopname.value);
    auto project_hash_index = projects.get_index<"byhash"_n>();

    auto project_itr = project_hash_index.find(project_hash);

    if (project_itr == project_hash_index.end()) {
        return std::nullopt;
    }

    return project(*project_itr);
  }

  /**
   * @brief Получает проект по хэшу, если проект не найден, выбрасывает исключение
   * 
   * @param coopname Имя кооператива
   * @param project_hash Хэш проекта
   * @return project 
   */
  inline project get_project_or_fail(eosio::name coopname, const checksum256 &project_hash) {
    auto project = get_project(coopname, project_hash);
    eosio::check(project.has_value(), "Проект с указанным хэшем не найден");
    return project.value();
  }
  
  /**
   * @brief Получает проект по id
   * 
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @return Проект
   */
   inline project get_project_by_id_or_fail(eosio::name coopname, const uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto prj = projects.find(project_id);
    eosio::check(prj != projects.end(), "Проект не найден");
    
    return project(*prj);
  }

  /**
   * @brief Есть ли у проекта дочерние проекты-компоненты (их parent_hash совпадает с хэшем родителя)
   * @param coopname Имя кооператива
   * @param project_hash Хэш родительского проекта
   */
  inline bool has_component_projects(eosio::name coopname, const checksum256 &project_hash) {
    project_index projects(_capital, coopname.value);
    auto parent_idx = projects.get_index<"byparenthash"_n>();
    auto it = parent_idx.find(project_hash);
    return it != parent_idx.end() && it->parent_hash == project_hash;
  }

    
  /**
   * @brief Проверяет валидность parent_hash согласно правилам проектов
   * 
   * @param coopname Имя кооператива
   * @param parent_hash Хэш родительского проекта для проверки
   */
  inline void validate_parent_hash(eosio::name coopname, const checksum256 &parent_hash) {
    checksum256 empty_hash = checksum256();
    
    if (parent_hash != empty_hash) {
        auto parent_project = get_project_or_fail(coopname, parent_hash);
        eosio::check(parent_project.parent_hash == empty_hash, 
                     "Запрещено создавать проекты глубже одного уровня. У родительского проекта не должно быть своего родителя");
    }
  }

  /**
   * @brief Создает проект
   *
   * @param coopname Имя кооператива
   * @param project_hash Хэш проекта
   * @param parent_hash Хэш родительского проекта (если есть)
   * @param title Название проекта
   * @param description Описание проекта
   * @param invite Приглашение к проекту
   * @param meta Метаданные проекта
   * @param data Шаблон/данные проекта
   */
  inline void create_project(eosio::name coopname, const checksum256 &project_hash, const checksum256 &parent_hash, const std::string &title, const std::string &description, const std::string &invite, const std::string &meta, const std::string &data) {
    
    project_index projects(_capital, coopname.value);    
    
    projects.emplace(coopname, [&](auto& row) {
      row.id = get_global_id_in_scope(_capital, coopname, "projects"_n);
      row.status = Capital::Projects::Status::PENDING;
      row.project_hash = project_hash;
      row.parent_hash = parent_hash;
      row.coopname = coopname;
      row.title = title;
      row.description = description;
      row.invite = invite;
      row.meta = meta;
      row.data = data;
      row.is_planed = false; // Изначально проект не запланирован
      row.is_authorized = false; // Все проекты требуют инициализации
      row.authorization = document2(); // Пустой документ авторизации
    });
  }

  /**
   * @brief Редактирует существующий проект
   *
   * @param coopname Имя кооператива
   * @param project_id ID проекта для редактирования
   * @param title Новое название проекта
   * @param description Новое описание проекта
   * @param invite Новое приглашение к проекту
   * @param meta Новые метаданные проекта
   * @param data Новые данные/шаблон проекта
   */
  inline void edit_project(eosio::name coopname, uint64_t project_id, const std::string &title, const std::string &description, const std::string &invite, const std::string &meta, const std::string &data) {

    project_index projects(_capital, coopname.value);
    auto project_itr = projects.find(project_id);
    eosio::check(project_itr != projects.end(), "Проект не найден");
    projects.modify(project_itr, coopname, [&](auto& row) {
      // Всегда обновляем строковые поля
      row.title = title;
      row.description = description;
      row.invite = invite;
      row.meta = meta;
      row.data = data;
    });
  }

    /**
   * @brief Добавляет имущественный взнос к проекту.
   * @param coopname Имя кооператива (scope таблицы).
   * @param project_id ID проекта.
   * @param property_amount Стоимость имущественного взноса.
   */
  inline void add_property_base(eosio::name coopname, uint64_t project_id, const eosio::asset &property_amount) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      projects.modify(project, _capital, [&](auto &p) {
          // Добавляем стоимость имущества в пул себестоимостей
          p.fact.property_base_pool += property_amount;
          
          // Обновляем общую сумму генерации (имущество - это интеллектуальный вклад)
          p.fact.total_generation_pool += property_amount;

          // Обновляем общую сумму вкладов
          p.fact.total_contribution += property_amount;
          p.fact.total = p.fact.total_contribution;
          p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments + p.fact.used_expense_pool;
      });
  }

  /**
   * @brief Добавляет коммит к проекту, обновляя фактические показатели и счетчик коммитов.
   * @param coopname Имя кооператива (scope таблицы).
   * @param project_id ID проекта.
   * @param delta Фактические показатели взноса в проект.
   */
  inline void add_commit(eosio::name coopname, uint64_t project_id, const generation_amounts &delta) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      projects.modify(project, _capital, [&](auto &p) {
          // Увеличиваем счетчик коммитов
          p.counts.total_commits++;
          
          // Обновляем время создателей
          p.fact.creators_hours += delta.creators_hours;
          // Инкрементальное вычисление среднего для стоимости часа
          if (delta.hour_cost.amount > 0) {
              // Расчет скользящего среднего:
              // новая_средняя = (предыдущая_средняя * (n-1) + новое_значение) / n
              auto previous_commits = p.counts.total_commits - 1;
              if (previous_commits == 0) {
                  // Первый коммит - просто устанавливаем значение
                  p.fact.hour_cost = delta.hour_cost;
              } else {
                  // Последующие коммиты - рассчитываем среднее
                  auto weighted_sum = p.fact.hour_cost.amount * previous_commits;
                  auto new_average = (weighted_sum + delta.hour_cost.amount) / p.counts.total_commits;
                  p.fact.hour_cost = asset(new_average, p.fact.hour_cost.symbol);
              }
          }

          // Обновляем остальные пулы  
          p.fact.creators_base_pool += delta.creators_base_pool;
          p.fact.authors_base_pool += delta.authors_base_pool;
          p.fact.authors_bonus_pool += delta.authors_bonus_pool;
          p.fact.creators_bonus_pool += delta.creators_bonus_pool;
          
          // ВАЖНО: total_generation_pool должен включать все интеллектуальные вклады, 
          // включая уже накопленную базу координаторов и имущество
          p.fact.total_generation_pool = p.fact.creators_base_pool + p.fact.authors_base_pool + 
                                         p.fact.creators_bonus_pool + p.fact.authors_bonus_pool + 
                                         p.fact.coordinators_base_pool + p.fact.property_base_pool;

          // Пересчитываем премии участников от обновленной общей генерации
          p.fact.contributors_bonus_pool = Capital::Core::Generation::calculate_contributors_bonus_pool(p.fact.total_generation_pool);
          
          // Общая сумма вкладов пайщиков
          p.fact.total_contribution = p.fact.total_generation_pool + p.fact.contributors_bonus_pool;
          
          p.fact.total = p.fact.total_contribution;
          // Пересчитываем коэффициенты
          p.fact.return_base_percent = Capital::Core::Generation::calculate_return_base_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.invest_pool);
          p.fact.use_invest_percent = Capital::Core::Generation::calculate_use_invest_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.accumulated_expense_pool, p.fact.used_expense_pool, p.fact.total_received_investments);
          
          // Пересчитываем используемую часть инвестиций и полную стоимость
          p.fact.total_used_investments = eosio::asset(
              static_cast<int64_t>(static_cast<double>(p.fact.total_received_investments.amount) * (p.fact.use_invest_percent / 100.0)),
              _root_govern_symbol
          );
          p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments + p.fact.used_expense_pool;
      });
  }
  
  /**
   * @brief Назначает мастера проекта
   * 
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @param master Имя мастера
   */
  inline void set_master(eosio::name coopname, uint64_t project_id, eosio::name master) {
    Capital::project_index projects(_capital, coopname.value);
    auto project_itr = projects.find(project_id);
    eosio::check(project_itr != projects.end(), "Проект не найден");
    projects.modify(project_itr, coopname, [&](auto &p) {
        p.master = master;
    });
    
  }

  /**
  * @brief Обновляет статус проекта.
  * @param coopname Имя кооператива (scope таблицы).
  * @param project_hash Хэш проекта.
  * @param new_status Новый статус проекта.
  */
  inline void update_status(eosio::name coopname, uint64_t project_id, eosio::name new_status) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      
      projects.modify(project, coopname, [&](auto &p) {
          p.status = new_status;
      });
  }

  /**
  * @brief Устанавливает плановые показатели проекта.
  * @param coopname Имя кооператива (scope таблицы).
  * @param project_id ID проекта.
  * @param calculated_plan Рассчитанные плановые показатели.
  */
  inline void set_plan(eosio::name coopname, uint64_t project_id, const plan_pool &calculated_plan) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      projects.modify(project, coopname, [&](auto &p) {
        p.plan = calculated_plan;
        p.is_planed = true; // Проект теперь запланирован
      });
  }

  /**
   * @brief Добавляет инвестицию к проекту.
   * @param coopname Имя кооператива (scope таблицы).
   * @param project_id ID проекта.
   * @param amount Сумма инвестиции для добавления.
   */
  inline void add_investments(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      
      projects.modify(project, coopname, [&](auto &p) {
          // Рассчитываем сколько средств еще нужно для достижения цели по расходам
          eosio::asset expense_gap = p.plan.target_expense_pool - p.fact.accumulated_expense_pool;
          
          // Рассчитываем какую часть инвестиций направить в пул расходов
          eosio::asset to_expense_pool = asset(0, _root_govern_symbol);
          
          if (expense_gap.amount > 0) {
              // Рассчитываем процент от инвестиций для пула расходов
              auto st = Capital::State::get_global_state(coopname);
              eosio::asset potential_to_expense = amount * st.config.expense_pool_percent / 100;
              
              // Но не больше, чем нужно для достижения цели
              to_expense_pool = (potential_to_expense.amount <= expense_gap.amount) ? potential_to_expense : expense_gap;
          }
          
          // Остальные средства идут в инвестиционный пул
          eosio::asset to_invest_pool = amount - to_expense_pool;
          
          // Обновляем пулы
          p.fact.invest_pool += to_invest_pool;
          p.fact.accumulated_expense_pool += to_expense_pool;
          p.fact.total_received_investments += amount;  // Увеличиваем общую сумму полученных инвестиций
          
          // Пересчитываем коэффициенты возврата
          p.fact.return_base_percent = Capital::Core::Generation::calculate_return_base_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.invest_pool);
          p.fact.use_invest_percent = Capital::Core::Generation::calculate_use_invest_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.accumulated_expense_pool, p.fact.used_expense_pool, p.fact.total_received_investments);
          
          // Пересчитываем используемую часть инвестиций и полную стоимость
          p.fact.total_used_investments = eosio::asset(
              static_cast<int64_t>(static_cast<double>(p.fact.total_received_investments.amount) * (p.fact.use_invest_percent / 100.0)),
              _root_govern_symbol
          );
          p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments + p.fact.used_expense_pool;
      });
  }


  /**
   * @brief Увеличивает целевой размер пула расходов проекта.
   * @param coopname Имя кооператива (scope таблицы).
   * @param project_id ID проекта.
   * @param additional_amount Дополнительная сумма для увеличения цели расходов.
   */
  inline void expand_expense_pool(eosio::name coopname, uint64_t project_id, const eosio::asset &additional_amount) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      
      projects.modify(project, coopname, [&](auto &p) {
          // Увеличиваем целевой размер пула расходов в фактических показателях
          p.fact.target_expense_pool += additional_amount;
      });
  }

  /**
   * @brief Открывает проект для инвестиций, копируя плановые показатели расходов в фактические.
   * @param coopname Имя кооператива (scope таблицы).
   * @param project_id ID проекта.
   */
  inline void open_project(eosio::name coopname, uint64_t project_id) {
      
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      projects.modify(project, coopname, [&](auto &p) {
          // Копируем целевые показатели расходов из плана в факт
          p.fact.target_expense_pool = p.plan.target_expense_pool;

          // Остальные поля расходов остаются нулевыми (accumulated_expense_pool, used_expense_pool)
          // так как фактических поступлений и трат еще не было

          // Меняем статус на "opened"
          p.is_opened = true;
      });
  }

  /**
   * @brief Закрывает проект от инвестиций, устанавливая флаг is_opened = false.
   * @param coopname Имя кооператива (scope таблицы).
   * @param project_id ID проекта.
   */
  inline void close_project(eosio::name coopname, uint64_t project_id) {
      project_index projects(_capital, coopname.value);
      auto project = projects.find(project_id);
      eosio::check(project != projects.end(), "Проект не найден");
      projects.modify(project, coopname, [&](auto &p) {
          // Закрываем проект от инвестиций
          p.is_opened = false;
      });
  }

  /**
   * @brief Резервирует средства для расхода, уменьшая accumulated_expense_pool.
   * @param coopname Имя кооператива.
   * @param project_id ID проекта.
   * @param amount Сумма для резервирования.
   */
  inline void reserve_expense_funds(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
      project_index projects(_capital, coopname.value);
      auto project_for_modify = projects.find(project_id);
      eosio::check(project_for_modify != projects.end(), "Проект не найден");
      
      
      projects.modify(project_for_modify, coopname, [&](auto &p) {
          eosio::check(p.fact.accumulated_expense_pool >= amount, 
                       "Недостаточно средств в пуле расходов");
          p.fact.accumulated_expense_pool -= amount;
      });
  }

  /**
   * @brief Возвращает зарезервированные средства в accumulated_expense_pool.
   * @param coopname Имя кооператива.
   * @param project_id ID проекта.
   * @param amount Сумма для возврата.
   */
  inline void return_expense_funds(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
      project_index projects(_capital, coopname.value);
      auto project_for_modify = projects.find(project_id);
      eosio::check(project_for_modify != projects.end(), "Проект не найден");
      
      projects.modify(project_for_modify, coopname, [&](auto &p) {
          p.fact.accumulated_expense_pool += amount;
      });
  }

  /**
   * @brief Завершает расход, добавляя сумму в used_expense_pool.
   * @param coopname Имя кооператива.
   * @param project_id ID проекта.
   * @param amount Сумма расхода.
   */
  inline void complete_expense(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
      project_index projects(_capital, coopname.value);
      auto project_for_modify = projects.find(project_id);
      eosio::check(project_for_modify != projects.end(), "Проект не найден");
      
      projects.modify(project_for_modify, coopname, [&](auto &p) {
          p.fact.used_expense_pool += amount;
          
          // Пересчитываем total, т.к. он зависит от вкладов, но больше не включает расходы напрямую
          p.fact.total = p.fact.total_contribution;
          
          // Пересчитываем use_invest_percent, т.к. он зависит от used_expense_pool
          p.fact.use_invest_percent = Capital::Core::Generation::calculate_use_invest_percent(p.fact.creators_base_pool, p.fact.authors_base_pool, p.fact.coordinators_base_pool, p.fact.accumulated_expense_pool, p.fact.used_expense_pool, p.fact.total_received_investments);
          
          // Пересчитываем используемую часть инвестиций и полную стоимость
          p.fact.total_used_investments = eosio::asset(
              static_cast<int64_t>(static_cast<double>(p.fact.total_received_investments.amount) * (p.fact.use_invest_percent / 100.0)),
              _root_govern_symbol
          );
          p.fact.total_with_investments = p.fact.total + p.fact.total_used_investments + p.fact.used_expense_pool;
      });
  }
  
  /**
   * @brief Увеличивает количество проперторов в проекте на 1
   */
  inline void increment_total_propertors(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_propertors += 1;
    });
  }
  
  /**
   * @brief Увеличивает количество инвесторов в проекте на 1
   */
   inline void increment_total_investors(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_investors += 1;
    });
  }

  /**
   * @brief Увеличивает количество зарегистрированных участников в проекте на 1
   */
  inline void increment_total_contributors(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");

    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_contributors += 1;
    });
  }

  /**
   * @brief Увеличивает количество вкладчических долей в проекте на указанное количество
   */
  inline void increment_total_contributor_shares(eosio::name coopname, uint64_t project_id, eosio::asset shares) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);

    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.crps.total_capital_contributors_shares += shares;
    });
  }
  
  /**
   * @brief Увеличивает количество авторов в проекте на 1
   */
  inline void increment_total_authors(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_authors += 1;
    });
  }
  
    /**
   * @brief Увеличивает количество координаторов в проекте на 1
   */
  inline void increment_total_coordinators(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_coordinators += 1;
    });
  }
  
  /**
   * @brief Увеличивает количество создателей в проекте на 1
   */
  inline void increment_total_creators(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_creators += 1;
    });
  }

  /**
   * @brief Увеличивает количество уникальных участников в проекте на 1
   */
  inline void increment_total_unique_participants(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.counts.total_unique_participants += 1;
    });
  }

  /**
   * @brief Увеличивает счетчик полученных голосов в проекте
   */
  inline void increment_votes_received(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_for_modify = projects.find(project_id);
    eosio::check(project_for_modify != projects.end(), "Проект не найден");
    
    projects.modify(project_for_modify, _capital, [&](auto &p) {
      p.voting.votes_received++;
    });
  }

  inline void increase_total_returned_investments(eosio::name coopname, const uint64_t &project_id, const eosio::asset &amount) {
    // Обновляем проект - увеличиваем сумму возвращенных инвестиций
    Capital::project_index projects(_capital, coopname.value);
    auto project_itr = projects.find(project_id);
    eosio::check(project_itr != projects.end(), "Проект не найден");
    projects.modify(project_itr, coopname, [&](auto &p) {
      p.fact.total_returned_investments += amount;
    });

    
  }

  /**
   * @brief Увеличивает сумму использованных для компенсации инвестиций
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @param amount Сумма использованных инвестиций
   */
  inline void add_used_for_compensation(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
    project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");
    projects.modify(project, _capital, [&](auto &p) {
      p.fact.total_used_for_compensation += amount;
    });
  }

  
  /**
   * @brief Уменьшает сумму использованных для компенсации инвестиций
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @param amount Сумма использованных инвестиций
   */
   inline void subtract_used_for_compensation(eosio::name coopname, uint64_t project_id, const eosio::asset &amount) {
    project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");
    eosio::check(project->fact.total_used_for_compensation >= amount, "Недостаточно использованных инвестиций для вычитания");

    projects.modify(project, _capital, [&](auto &p) {
      p.fact.total_used_for_compensation -= amount;
    });
  }

  /**
   * @brief Инкрементирует счётчик сконвертированных сегментов
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   */
  inline void increment_converted_segments(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");
    
    projects.modify(project, _capital, [&](auto &p) {
      p.counts.total_converted_segments++;
    });
  }

  /**
   * @brief Проверяет завершили ли все участники конвертацию сегментов
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @return true если все участники сконвертировали сегменты
   */
  inline bool are_all_segments_converted(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");
    // Все уникальные участники должны сконвертировать свои сегменты
    return project->counts.total_converted_segments >= project->counts.total_unique_participants;
  }

  /**
   * @brief Считает неиспользованные проектом инвестиции
   *
   * Неиспользованный остаток = все полученные инвестиции минус то, что проект
   * фактически израсходовал: выплаты участникам при конвертации сегментов
   * (total_used_for_compensation) и оплаченные расходы (used_expense_pool).
   * В сумму входят и прямые инвестиции пайщиков, и аллоцированные программные
   * средства — возврат идёт единым остатком в глобальный пул программы, потому
   * что деньги инвесторов уже находятся в «Благоросте» и лично им не возвращаются.
   *
   * Единая точка расчёта для всех сценариев возврата: финализация
   * (finalizeproj), остановка (stopproject), отмена (cancelproj), удаление
   * (delproject) и отклонение советом (declprj).
   *
   * @param prj Проект
   * @return Неиспользованный остаток (никогда не отрицательный)
   */
  inline eosio::asset calculate_unused_investments(const project &prj) {
    int64_t used = prj.fact.total_used_for_compensation.amount + prj.fact.used_expense_pool.amount;
    int64_t unused = prj.fact.total_received_investments.amount - used;

    return eosio::asset(unused > 0 ? unused : 0, _root_govern_symbol);
  }

  /**
   * @brief Удаляет проект
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   */
  inline void delete_project(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_itr = projects.find(project_id);
    eosio::check(project_itr != projects.end(), "Проект не найден");
    projects.erase(project_itr);
  }

  /**
   * @brief Устанавливает авторизацию проекта советом
   */
  inline void authorize_project(eosio::name coopname, uint64_t project_id, const document2 &decision) {
    project_index projects(_capital, coopname.value);
    auto project_itr = projects.find(project_id);
    eosio::check(project_itr != projects.end(), "Проект не найден");
    projects.modify(project_itr, coopname, [&](auto& row) {
      row.is_authorized = true;
      row.authorization = decision;
    });
  }

  /**
   * @brief Сбрасывает авторизацию проекта
   * Устанавливает флаг авторизации в false и очищает документ авторизации
   * @param coopname Наименование кооператива
   * @param project_id ID проекта
   */
  inline void revoke_authorization(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project_itr = projects.find(project_id);
    eosio::check(project_itr != projects.end(), "Проект не найден");
    projects.modify(project_itr, coopname, [&](auto& row) {
      row.is_authorized = false;
      row.authorization = document2(); // Пустой документ авторизации
    });
  }

  /**
   * @brief Увеличивает счетчик общего количества участников голосования в проекте
   */
  inline void increment_total_voters(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");
    projects.modify(project, _capital, [&](auto &p) {
      p.voting.total_voters++;
    });
  }
  

}// namespace Project