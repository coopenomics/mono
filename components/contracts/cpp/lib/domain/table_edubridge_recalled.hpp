#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include "../consts.hpp"
#include "../core/ram_payer.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Материалы, снятые с ответственного хранения (`recallrid`), — для
 * повторной передачи того же занятия.
 *
 * Совет отказал в приёме паевого взноса результатом: материалы возвращаются
 * преподавателю, запись `edurids` стирается. Занятие при этом уже проведено и
 * рассчитано с учениками — оплата занятия осталась в резерве преподавателям
 * курса, номер занятия занят. Преподаватель вправе провести занятие заново
 * и передать материалы ещё раз (решение владельца 01.11.2026): ученики
 * второй раз не платят, взнос — та же сумма из уже собранной оплаты.
 * `reholdrid` берёт сумму, допуск и курс отсюда и стирает запись.
 *
 * scope = coopname; primary_key = id; поиск по прежнему `rid_hash`.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_recalled {
  uint64_t id;                       ///< внутренний ID
  checksum256 rid_hash;              ///< хэш снятых материалов (прежний process_hash p.edu.rid)
  eosio::name username;              ///< пайщик-преподаватель
  uint64_t assignment_id;            ///< допуск, по которому были приняты материалы
  eosio::asset amount;               ///< оценка материалов — сумма будущего паевого взноса
  eosio::name rid_type;              ///< вид РИД
  eosio::time_point_sec hold_until;  ///< срок хранения прежних материалов (гарантийный срок курса)
  uint64_t course_id;                ///< курс, из резерва которого оплачивается результат
  eosio::time_point_sec recalled_at; ///< когда материалы сняты с хранения

  uint64_t primary_key()  const { return id; }
  checksum256 by_hash()   const { return rid_hash; }
};

typedef eosio::multi_index<
    "edurecalled"_n, edu_recalled,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<edu_recalled, checksum256, &edu_recalled::by_hash>>>
    edu_recalled_index;

} // namespace Edubridge
