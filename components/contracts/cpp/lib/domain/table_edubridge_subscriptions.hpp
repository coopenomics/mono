#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Периоды подписки на курс ЦПП «Образование».
 */
namespace SubscriptionPeriod {
  inline constexpr eosio::name MONTH = "month"_n;
  inline constexpr eosio::name YEAR  = "year"_n;

  inline bool is_valid(eosio::name period) {
    return period == MONTH || period == YEAR;
  }
}

/**
 * @brief Активная подписка пайщика на курс — анкер процесса p.edu.access.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `sub_hash` — этот hash используется как `process_hash` в ledger2-операции
 * конвертации (o.edu.conv) и в документах процесса.
 *
 * В RAM живут только активные подписки: `expiresub` стирает запись по
 * истечении `paid_until` (chain-RAM — рабочее состояние, история — у
 * парсера в blockchain_actions/blockchain_deltas). Статуса в таблице нет.
 *
 * `learner_id` / `course_id` — идентификаторы обучающегося и курса в
 * приложении «Образовательный мост»; контракт их не интерпретирует.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_subscription {
  uint64_t id;                       ///< внутренний ID
  checksum256 sub_hash;              ///< process_hash для p.edu.access
  eosio::name username;              ///< пайщик-плательщик (родитель-слушатель)
  uint64_t learner_id;               ///< обучающийся (off-chain id приложения)
  uint64_t course_id;                ///< курс (off-chain id приложения)
  eosio::name period;                ///< период оплаты: month | year
  eosio::time_point_sec paid_until;  ///< оплачено до
  checksum256 statement_hash;        ///< hash последнего Заявления о конвертации, по которому оплачен период
  eosio::time_point_sec created_at;  ///< открытие подписки
  eosio::time_point_sec updated_at;  ///< последнее продление

  uint64_t primary_key()      const { return id; }
  checksum256 by_hash()       const { return sub_hash; }
  uint64_t by_username()      const { return username.value; }
  uint64_t by_paid_until()    const { return static_cast<uint64_t>(paid_until.sec_since_epoch()); }
};

typedef eosio::multi_index<
    "edusubs"_n, edu_subscription,
    eosio::indexed_by<"byhash"_n,      eosio::const_mem_fun<edu_subscription, checksum256, &edu_subscription::by_hash>>,
    eosio::indexed_by<"byusername"_n,  eosio::const_mem_fun<edu_subscription, uint64_t,    &edu_subscription::by_username>>,
    eosio::indexed_by<"bypaiduntil"_n, eosio::const_mem_fun<edu_subscription, uint64_t,    &edu_subscription::by_paid_until>>>
    edu_subscriptions_index;

} // namespace Edubridge
