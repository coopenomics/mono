#pragma once

#include <eosio/eosio.hpp>
#include <string>

/**
 * @ingroup public_tables
 */
struct verification {
  eosio::name verificator;
  bool is_verified;
  eosio::name procedure;
  eosio::time_point_sec created_at;
  eosio::time_point_sec last_update;
  std::string notice;
};

/**
 * @brief Процедуры верификации личности, известные системе.
 * Список расширяется по мере появления новых сервисов верификации.
 */
inline bool is_known_verification_procedure(eosio::name procedure) {
  return procedure == "online"_n || procedure == "passport"_n;
}

/**
 * @brief Процедуры, которые вправе подтверждать кооперативный участок
 * (председатель участка или его доверенное лицо) при личной явке пайщика.
 */
inline bool is_branch_verification_procedure(eosio::name procedure) {
  return procedure == "passport"_n;
}
