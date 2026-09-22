#pragma once


#include "../../../lib/core/ram_payer.hpp"
#include "generation_amounts.hpp"

using namespace eosio;
using std::string;

namespace Capital::Commits {
  /**
   * @brief Константы статусов коммитов
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    constexpr eosio::name CREATED = "created"_n;     ///< Коммит создан
  }
}

namespace Capital::Commits {

  /**
   * @brief Таблица коммитов хранит данные о выполненных операциях в проекте.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): commits 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] commit {
    uint64_t id;                                    ///< ID коммита (внутренний ключ)
    name coopname;                                  ///< Имя кооператива
    name username;                                  ///< Имя пользователя, совершившего действие
    name status;                                    ///< Статус коммита (created | approved | authorized | act1 | act2)
    checksum256 project_hash;                       ///< Хэш проекта, связанного с действием
    checksum256 commit_hash;                        ///< Хэш действия
    std::string description;                        ///< Описание действия
    std::string meta;                               ///< Метаданные коммита
    generation_amounts amounts;                     ///< Рассчитанные показатели генерации
    time_point_sec created_at;                      ///< Дата и время создания действия

    uint64_t primary_key() const { return id; }     ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_commit_hash() const { return commit_hash; } ///< Индекс по хэшу коммита (3)
    checksum256 by_project_hash() const { return project_hash; } ///< Индекс по хэшу проекта (4)
  };

typedef eosio::multi_index<
    "commits"_n, commit,
    indexed_by<"byusername"_n, const_mem_fun<commit, uint64_t, &commit::by_username>>,
    indexed_by<"byhash"_n, const_mem_fun<commit, checksum256, &commit::by_commit_hash>>,
    indexed_by<"byprojhash"_n, const_mem_fun<commit, checksum256, &commit::by_project_hash>>
> commit_index;



/**
 * @brief Получает действие по хэшу действия.
 * @param coopname Имя кооператива (scope таблицы).
 * @param hash Хэш действия.
 * @return `std::optional<commit>` - найденное действие или `std::nullopt`, если его нет.
 */
 inline std::optional<commit> get_commit(eosio::name coopname, const checksum256 &hash) {
  commit_index commits(_capital, coopname.value);
  auto commit_index = commits.get_index<"byhash"_n>();

  auto itr = commit_index.find(hash);
  if (itr == commit_index.end()) {
      return std::nullopt;
  }

  return commit(*itr);

}


/**
 * @brief Получает действие по хэшу действия.
 * @param coopname Имя кооператива (scope таблицы).
 * @param hash Хэш действия.
 * @return `commit` - найденное действие.
 */
 inline commit get_commit_or_fail(eosio::name coopname, const checksum256 &hash) {
  auto commit = get_commit(coopname, hash);
  eosio::check(commit.has_value(), "Коммит не найден");

  return commit.value();
}

/**
 * @brief Удаляет коммит по хэшу действия.
 * @param coopname Имя кооператива (scope таблицы).
 * @param commit_id ID коммита.
 */
inline void delete_commit(eosio::name coopname, const uint64_t &commit_id) {
  commit_index commits(_capital, coopname.value);
  auto itr = commits.find(commit_id);
  eosio::check(itr != commits.end(), "Коммит не найден");

  commits.erase(itr);
}

/**
 * @brief Создает коммит без отправки на утверждение.
 * @param coopname Имя кооператива.
 * @param username Имя пользователя.
 * @param project_hash Хэш проекта.
 * @param commit_hash Хэш коммита.
 * @param calculated_fact Рассчитанные показатели генерации.
 */
inline void create_commit(
  eosio::name coopname,
  eosio::name username,
  checksum256 project_hash,
  checksum256 commit_hash,
  std::string description,
  std::string meta,
  const generation_amounts &calculated_fact
) {
  // Создаем коммит
  commit_index commits(_capital, coopname.value);
  auto commit_id = get_global_id_in_scope(_capital, coopname, "commits"_n);
  
  // Создаем коммит в таблице commits
  commits.emplace(RamPayer::of(commits, coopname), [&](auto &c) {
    c.id = commit_id;
    c.status = Capital::Commits::Status::CREATED;
    c.coopname = coopname;
    c.username = username;
    c.project_hash = project_hash;
    c.commit_hash = commit_hash;
    c.description = description;
    c.meta = meta;
    c.amounts = calculated_fact;
    c.created_at = current_time_point();
  });
}

} // namespace Capital::Commits

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::Commits::commit, cooperative);
