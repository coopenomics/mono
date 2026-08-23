#pragma once

#include <algorithm>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "document_core.hpp"

/**
 * @file
 * Универсальный механизм «собрание пайщиков → решение» на контракте BRANCH.
 * Зеркало Совета: тип решения `free` (свободное — просто фиксируется протоколом)
 * либо автоматизируемый (`createbranch` — после утверждения председателем уходит
 * в совет действием exec и по решению совета создаёт кооперативный участок).
 * Якорь записи — hash (byhash). Голос фиксируется бюллетенем-заявлением;
 * протокол утверждает один председатель собрания (секретарь не нужен).
 * Жизненный цикл — Chain-RAM: терминал = erase, история — в журнале действий парсера.
 */

/// Минимальный кворум учредительного собрания (число подписанных бюллетеней).
static constexpr uint64_t MIN_DECISION_QUORUM = 3;

/// Длительность окна голосования собрания пайщиков участка (секунд).
/// Голосование короткое — проходит прямо на собрании: организатор открывает
/// его кнопкой, дедлайн отмеряется автоматически.
static constexpr uint32_t DECISION_VOTING_WINDOW_SECONDS = 15 * 60;

/// Точка повестки дня собрания (вход действия createdec).
struct decision_point {
  std::string title;     ///< Текст вопроса
  std::string decision;  ///< Проект решения по вопросу
  std::string context;   ///< Контекст вопроса (может быть пустым)
};

/// Голос участника по одному вопросу повестки (вход действия votedec).
struct decision_vote_point {
  uint64_t question_id;  ///< Идентификатор вопроса
  eosio::name vote;      ///< Голос: "for"_n | "against"_n | "abstained"_n
};

/**
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: decisions
 */
struct [[eosio::table, eosio::contract(BRANCH)]] coodecision {
  uint64_t id;                            ///< Идентификатор решения
  eosio::checksum256 hash;                ///< Якорь процесса (внешний идентификатор)
  eosio::name coopname;                   ///< Имя кооператива
  eosio::name type;                       ///< Тип решения: "free" | "createbranch"
  eosio::name initiator;                  ///< Организатор собрания
  eosio::name chairman;                   ///< Председатель собрания — выбирается организатором из участников при открытии голосования (для createbranch — он же кандидат в председатели КУ)
  eosio::name status;                     ///< opened | voting | approved | onapproval

  document2 proposal;                     ///< Подписанное предложение/повестка инициатора
  document2 protocol;                     ///< Протокол решения (утверждает председатель)
  document2 petition;                     ///< Заявление председателя в совет (для createbranch)
  document2 liability;                    ///< Договор о полной индивидуальной материальной ответственности председателя КУ (подписан председателем участка, ждёт встречной подписи председателя совета)
  document2 authority;                     ///< Доверенность председателю КУ (подписана председателем участка, ждёт встречной подписи председателя совета)
  document2 authorization;                ///< Решение совета (callback)

  eosio::time_point_sec open_at;          ///< Начало голосования
  eosio::time_point_sec close_at;         ///< Плановое закрытие голосования
  uint64_t signed_ballots;                ///< Число поданных бюллетеней

  eosio::name braname;                    ///< Заранее сгенерированный аккаунт будущего КУ (createbranch)
  std::string address;                    ///< Адрес привязки КУ (createbranch)

  std::vector<eosio::name> participants;  ///< Присоединившиеся участники собрания
  eosio::time_point_sec created_at;       ///< Дата создания
  // Место и время проведения собрания НЕ публикуются в блокчейн —
  // это приватные данные пайщиков, живут в БД платформы (composite db-слой).

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return hash; }

  bool is_participant(const eosio::name &username) const {
    return std::find(participants.begin(), participants.end(), username) != participants.end();
  }
};

typedef eosio::multi_index<
    "decisions"_n, coodecision,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<coodecision, eosio::checksum256, &coodecision::by_hash>>>
    decision_index;

/**
 * @ingroup public_tables
 * @ingroup public_branch_tables
 * @par table: decisionq
 */
struct [[eosio::table, eosio::contract(BRANCH)]] coodecquest {
  uint64_t id;                                 ///< Идентификатор вопроса
  uint64_t decision_id;                        ///< Идентификатор решения
  uint64_t number;                             ///< Номер вопроса в повестке
  eosio::name coopname;                        ///< Имя кооператива

  std::string title;                           ///< Текст вопроса
  std::string decision;                        ///< Проект решения по вопросу
  std::string context;                         ///< Контекст вопроса

  uint64_t counter_votes_for;                  ///< Счётчик голосов за
  uint64_t counter_votes_against;              ///< Счётчик голосов против
  uint64_t counter_votes_abstained;            ///< Счётчик воздержавшихся

  std::vector<eosio::name> voters_for;         ///< Проголосовавшие за
  std::vector<eosio::name> voters_against;     ///< Проголосовавшие против
  std::vector<eosio::name> voters_abstained;   ///< Воздержавшиеся

  uint64_t primary_key() const { return id; }
  uint64_t by_decision() const { return decision_id; }
};

typedef eosio::multi_index<
    "decisionq"_n, coodecquest,
    eosio::indexed_by<"bydecision"_n, eosio::const_mem_fun<coodecquest, uint64_t, &coodecquest::by_decision>>>
    coodecquest_index;

/// Получить решение по якорю или упасть.
inline coodecision get_decision_or_fail(eosio::name coopname, eosio::checksum256 hash) {
  decision_index decisions(_branch, coopname.value);
  auto idx = decisions.get_index<"byhash"_n>();
  auto itr = idx.find(hash);
  eosio::check(itr != idx.end(), "Решение собрания не найдено");
  return *itr;
}

/// Удалить все вопросы повестки данного решения (при erase решения).
inline void erase_coodecquests(eosio::name coopname, uint64_t decision_id) {
  coodecquest_index questions(_branch, coopname.value);
  auto by_dec = questions.get_index<"bydecision"_n>();
  auto itr = by_dec.lower_bound(decision_id);
  while (itr != by_dec.end() && itr->decision_id == decision_id) {
    itr = by_dec.erase(itr);
  }
}
