#pragma once

#include "../core/gamification/gamification.hpp"

using namespace eosio;
using std::string;

namespace Capital {

  /**
   * @brief Таблица участников хранит данные индивидуального участника кооператива.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): contributors 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] contributor {
    uint64_t id;                                    ///< ID контрибьютора (внутренний ключ)
    name coopname;                                  ///< Имя кооператива
    name username;                                  ///< Имя пользователя
    checksum256 contributor_hash;                   ///< Внешний идентификатор контрибьютора
    time_point_sec created_at;                      ///< Время создания контрибьютора
    name status;                                    ///< Статус контрибьютора
    std::string memo;                                ///< Мемо для импортированных контрибьюторов
    bool is_external_contract = false;              ///< Флаг, указывающий на внешний контракт
    document2 contract;                             ///< Договор УХД
    std::vector<checksum256> appendixes;            ///< Вектор хэшей проектов, для которых подписаны приложения
    
    eosio::asset rate_per_hour = asset(0, _root_govern_symbol); ///< Ставка за час
    uint64_t hours_per_day = 0; ///< Часы в день
    eosio::asset debt_amount = asset(0, _root_govern_symbol);   ///< Сумма долга
    
    eosio::asset contributed_as_investor = asset(0, _root_govern_symbol);     ///< Сумма, вложенная в проект как инвестор
    eosio::asset contributed_as_creator = asset(0, _root_govern_symbol);      ///< Сумма, вложенная в проект как исполнитель
    eosio::asset contributed_as_author = asset(0, _root_govern_symbol);       ///< Сумма, вложенная в проект как автор
    eosio::asset contributed_as_coordinator = asset(0, _root_govern_symbol);  ///< Сумма, вложенная в проект как координатор
    eosio::asset contributed_as_contributor = asset(0, _root_govern_symbol);  ///< Сумма, вложенная в проект как контрибьютор
    eosio::asset contributed_as_propertor = asset(0, _root_govern_symbol);    ///< Сумма, вложенная в проект как пропертор
    
    // Геймификация: уровень и энергия
    uint32_t level = 1;                                   ///< Уровень участника (от 1 и выше, только растет)
    double energy = 99.9999999999;                                 ///< Текущая энергия участника (0.0 - 100.0)
    time_point_sec last_energy_update;                    ///< Время последнего обновления энергии
    
    uint64_t primary_key() const { return id; }                  ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; }      ///< Индекс по имени пользователя (2)
    checksum256 by_hash() const { return contributor_hash; }     ///< Индекс по хэшу контрибьютора (3)
    uint64_t by_investor_rating() const { return contributed_as_investor.amount; }     ///< Индекс по рейтингу инвестора (4)
    uint64_t by_creator_rating() const { return contributed_as_creator.amount; }       ///< Индекс по рейтингу создателя (5)
    uint64_t by_author_rating() const { return contributed_as_author.amount; }         ///< Индекс по рейтингу автора (6)
    uint64_t by_coordinator_rating() const { return contributed_as_coordinator.amount; } ///< Индекс по рейтингу координатора (7)
    uint64_t by_contributor_rating() const { return contributed_as_contributor.amount; } ///< Индекс по рейтингу контрибьютора (8)
    uint64_t by_propertor_rating() const { return contributed_as_propertor.amount; }     ///< Индекс по рейтингу пропертора (9)
    uint64_t by_rating() const { return contributed_as_investor.amount + contributed_as_creator.amount + contributed_as_author.amount + contributed_as_coordinator.amount + contributed_as_contributor.amount + contributed_as_propertor.amount; } ///< Индекс по общему рейтингу (10)
  };

typedef eosio::multi_index<
    "contributors"_n, contributor,
    indexed_by<"byusername"_n, const_mem_fun<contributor, uint64_t, &contributor::by_username>>,
    indexed_by<"byhash"_n, const_mem_fun<contributor, checksum256, &contributor::by_hash>>,
    indexed_by<"byinvrate"_n, const_mem_fun<contributor, uint64_t, &contributor::by_investor_rating>>,
    indexed_by<"bycreatorate"_n, const_mem_fun<contributor, uint64_t, &contributor::by_creator_rating>>,
    indexed_by<"byauthorate"_n, const_mem_fun<contributor, uint64_t, &contributor::by_author_rating>>,
    indexed_by<"bycoordrate"_n, const_mem_fun<contributor, uint64_t, &contributor::by_coordinator_rating>>,
    indexed_by<"bycontrate"_n, const_mem_fun<contributor, uint64_t, &contributor::by_contributor_rating>>,
    indexed_by<"byprprate"_n, const_mem_fun<contributor, uint64_t, &contributor::by_propertor_rating>>,
    indexed_by<"byrating"_n, const_mem_fun<contributor, uint64_t, &contributor::by_rating>>
> contributor_index;
}// namespace Capital

namespace Capital::Contributors {

  /**
   * @brief Константы статусов контрибьюторов
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
  namespace Status {
    const eosio::name PENDING = "pending"_n;       ///< Ожидает подтверждения
    const eosio::name ACTIVE = "active"_n; ///< Авторизован/активен
    const eosio::name IMPORT = "import"_n; ///< Импортирован, требует завершения регистрации
  }
  
  inline void create_contributor(eosio::name coopname, eosio::name username, checksum256 contributor_hash, bool is_external_contract, document2 contract, eosio::asset rate_per_hour, uint64_t hours_per_day){
    Capital::contributor_index contributors(_capital, coopname.value);
   
    contributors.emplace(coopname, [&](auto &c) {
      c.id = get_global_id_in_scope(_capital, coopname, "contributors"_n);
      c.coopname = coopname;
      c.username = username;
      c.contributor_hash = contributor_hash;
      c.status = Capital::Contributors::Status::PENDING;
      c.is_external_contract = is_external_contract;
      c.contract = contract;
      c.created_at = eosio::current_time_point();
      c.rate_per_hour = rate_per_hour;
      c.hours_per_day = hours_per_day;
      
      // Инициализация геймификации
      c.level = 1;
      c.energy = 99.9999999999;
      c.last_energy_update = eosio::current_time_point();
    });
  }
  
  
  /**
   * @brief Создаёт импортированного участника; contributed_as_investor сразу равен сумме импортируемого взноса в программу (как createpinv).
   */
  inline void import_contributor(
    eosio::name coopname,
    eosio::name username,
    checksum256 contributor_hash,
    eosio::asset contribution_amount,
    std::string memo
  ) {
    Capital::contributor_index contributors(_capital, coopname.value);

    contributors.emplace(coopname, [&](auto &c) {
      c.id = get_global_id_in_scope(_capital, coopname, "contributors"_n);
      c.coopname = coopname;
      c.username = username;
      c.contributor_hash = contributor_hash;
      c.status = Capital::Contributors::Status::IMPORT;
      c.is_external_contract = true;
      c.created_at = eosio::current_time_point();
      c.memo = memo;
      c.rate_per_hour = asset(0, _root_govern_symbol);
      c.hours_per_day = 0;
      c.contributed_as_investor = contribution_amount;

      // Инициализация геймификации
      c.level = 1;
      c.energy = 99.9999999999;
      c.last_energy_update = eosio::current_time_point();
    });
  }
  
  
  /**
   * @brief Добавляет project_hash в вектор appendixes у контрибьютора
   */
  inline void push_appendix_to_contributor(eosio::name coopname, uint64_t contributor_id, checksum256 project_hash){
    contributor_index contributors(_capital, coopname.value);
    auto contributor_itr = contributors.find(contributor_id);
    eosio::check(contributor_itr != contributors.end(), "Контрибьютор не найден");
    
    contributors.modify(contributor_itr, _capital, [&](auto &c) {
      c.appendixes.push_back(project_hash);
    });
  }

  /**
  * @brief Получает участника по имени аккаунта.
  */
  inline std::optional<contributor> get_contributor(eosio::name coopname, eosio::name username) {
    contributor_index contributors(_capital, coopname.value);
    auto username_index = contributors.get_index<"byusername"_n>();

    auto itr = username_index.find(username.value);
    if (itr == username_index.end()) {
        return std::nullopt;
    }

    return contributor(*itr);
  }




/**
 * @brief Получает участника по хэшу контрибьютора.
 */
 inline std::optional<contributor> get_contributor_by_hash(eosio::name coopname, const checksum256& contributor_hash) {
  contributor_index contributors(_capital, coopname.value);
  auto hash_index = contributors.get_index<"byhash"_n>();

  auto itr = hash_index.find(contributor_hash);
  if (itr == hash_index.end()) {
      return std::nullopt;
  }

  return contributor(*itr);
}


/**
* @brief Проверяет есть ли у контрибьютора приложение для проекта
*/
inline bool is_contributor_has_appendix_in_project(eosio::name coopname, const checksum256 &project_hash, uint64_t contributor_id) {
  contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);
  
  if (contributor == contributors.end()) {
      return false;
  }
  
  // Проверяем есть ли project_hash в векторе appendixes
  for (const auto& appendix_project_hash : contributor->appendixes) {
      if (appendix_project_hash == project_hash) {
          return true;
      }
  }
  
  return false;
}


/**
* @brief Получает участника по имени аккаунта и проверяет на активность.
*/
inline std::optional<contributor> get_active_contributor_or_fail(eosio::name coopname, eosio::name username) {
  auto contributor = get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Исполнитель не подписывал договор УХД");
  eosio::check(contributor -> status == Status::ACTIVE, "Договор УХД с пайщиком не активен");
  return contributor;
}


/**
* @brief Получает участника по имени аккаунта, проверяет активность и членство в проекте.
*/
inline std::optional<contributor> get_active_contributor_with_appendix_or_fail(eosio::name coopname, const checksum256 &project_hash, eosio::name username) {
  auto contributor = get_active_contributor_or_fail(coopname, username);
  eosio::check(is_contributor_has_appendix_in_project(coopname, project_hash, contributor->id), 
               "Пайщик не подписывал приложение к договору УХД для данного проекта");
  return contributor;
}

/**
 * @brief Контрибьютор, допустимый для @ref capital::regshare без приложения к проекту.
 * Статусы @p import (импорт с балансом до завершения регистрации) и @p active.
 * Приложение к УХД для конкретного проекта не требуется — начисление CRPS по доле возможно до допуска.
 */
inline std::optional<contributor> get_contributor_for_regshare_or_fail(eosio::name coopname, eosio::name username) {
  auto contributor = get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Исполнитель не подписывал договор УХД");
  const eosio::name st = contributor->status;
  eosio::check(st == Status::ACTIVE || st == Status::IMPORT,
               "Договор УХД с пайщиком не в статусе active или import");
  return contributor;
}

/**
 * @brief Контрибьютор, допустимый для программной инвестиции (@ref capital::createpinv).
 * Подходит любой статус — @p pending (договор УХД подписан пайщиком и ждёт одобрения
 * председателя), @p active и @p import.
 *
 * Одобренный договор УХД для инвестиции в программу «Благорост» не требуется:
 * участие в программе оформлено офертой, кошелёк программы уже открыт, юридических
 * ограничений на паевой взнос до одобрения УХД нет. Проверка активности здесь была
 * лишней и блокировала инвестицию сразу после регистрации, пока председатель не дошёл
 * до одобрения. На остальных действиях (проекты, коммиты, имущество) требование
 * активного УХД сохраняется.
 */
inline std::optional<contributor> get_contributor_for_program_invest_or_fail(eosio::name coopname, eosio::name username) {
  auto contributor = get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Исполнитель не подписывал договор УХД");
  return contributor;
}



/**
* @brief Обновляет накопительные показатели контрибьютора на основе его ролей и вкладов в сегменте
* @note Инвестиционная часть (investor_base) НЕ учитывается здесь, так как она уже учтена в момент инвестиции (createinvest)
*/
inline void update_contributor_ratings_from_segment(eosio::name coopname, uint64_t contributor_id, const Capital::Segments::segment& segment) {
  Capital::contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);

  eosio::check(contributor != contributors.end(), "Контрибьютор не найден");
  
  contributors.modify(contributor, _capital, [&](auto &c) {
    // ВАЖНО: contributed_as_investor НЕ обновляется здесь, так как обновляется в момент инвестиции (createinvest)
    // Это предотвращает двойное начисление для участников с несколькими ролями (инвестор+создатель/автор и т.д.)
    
    if (segment.is_author) {
      c.contributed_as_author += (segment.author_base + segment.author_bonus);
    }
    
    if (segment.is_creator) {
      c.contributed_as_creator += (segment.creator_base + segment.creator_bonus);
    }
    
    if (segment.is_coordinator) {
      c.contributed_as_coordinator += segment.coordinator_base;
    }
    
    if (segment.is_contributor) {
      c.contributed_as_contributor += segment.contributor_bonus;
    }
    
    if (segment.is_propertor) {
      c.contributed_as_propertor += segment.property_base;
    }
  });
  
  // Обновляем геймификацию (уровень и энергию) после обновления рейтингов
  Capital::Gamification::update_gamification_from_segment(coopname, contributor_id, segment);
}

/**
 * @brief Увеличивает долг контрибьютора
 */
inline void increase_debt_amount(eosio::name coopname, uint64_t contributor_id, eosio::asset amount) {
  contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);
  
  eosio::check(contributor != contributors.end(), "Контрибьютор не найден");
  //TODO: make coopname payer
  contributors.modify(contributor, _capital, [&](auto &c) {
    c.debt_amount += amount;
  });
}

/**
 * @brief Увеличивает долг контрибьютора
 */
 inline void decrease_debt_amount(eosio::name coopname, uint64_t contributor_id, eosio::asset amount) {
  contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);

  eosio::check(contributor != contributors.end(), "Контрибьютор не найден");
  eosio::check(contributor->debt_amount >= amount, "Недостаточно долга для погашения");

  //TODO: make coopname payer
  contributors.modify(contributor, _capital, [&](auto &c) {
    c.debt_amount -= amount;
  });
}

/**
 * @brief Обновляет параметры участника (часы в день и информацию о себе)
 */
inline void edit_contributor(eosio::name coopname, uint64_t contributor_id, eosio::asset rate_per_hour, uint64_t hours_per_day) {
  contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);

  eosio::check(contributor != contributors.end(), "Участник не найден");

  contributors.modify(contributor, coopname, [&](auto &c) {
    c.rate_per_hour = rate_per_hour;
    c.hours_per_day = hours_per_day;
  });
}

/**
 * @brief Увеличивает инвестиционный вклад участника
 * @param coopname Наименование кооператива
 * @param contributor_id ID контрибьютора
 * @param amount Сумма для увеличения инвестиционного вклада
 */
inline void increase_investor_contribution(eosio::name coopname, uint64_t contributor_id, eosio::asset amount) {
  contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);

  eosio::check(contributor != contributors.end(), "Участник не найден");

  contributors.modify(contributor, _capital, [&](auto &c) {
    c.contributed_as_investor += amount;
  });
}

/**
 * @brief Завершает регистрацию импортированного участника
 * Обновляет импортированного участника (статус IMPORT) данными регистрации:
 * - Устанавливает rate_per_hour и hours_per_day
 * - Меняет статус с IMPORT на PENDING (для внешних) или обновляет contract (для обычных)
 */
inline void complete_imported_contributor_registration(
  eosio::name coopname, 
  uint64_t contributor_id, 
  eosio::asset rate_per_hour, 
  uint64_t hours_per_day,
  bool is_external_contract,
  document2 contract
) {
  contributor_index contributors(_capital, coopname.value);
  auto contributor = contributors.find(contributor_id);

  eosio::check(contributor != contributors.end(), "Участник не найден");
  eosio::check(contributor->status == Status::IMPORT, "Участник не находится в статусе импорта");
  eosio::check(contributor->is_external_contract == is_external_contract, "Флаг внешнего контракта не совпадает с импортированным");

  contributors.modify(contributor, coopname, [&](auto &c) {
    c.rate_per_hour = rate_per_hour;
    c.hours_per_day = hours_per_day;
    // Для не внешних контрактов обновляем contract
    if (!is_external_contract) {
      c.contract = contract;
    }
    c.status = Status::PENDING; // Меняем статус на PENDING для одобрения председателем
  });
}


}// namespace Capital::Contributors