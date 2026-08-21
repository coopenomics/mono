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
 * @brief Процедуры, которые подтверждаются личной сверкой документа:
 * пайщик является лично, а факт фиксирует уполномоченное лицо кооператива —
 * председатель кооперативного участка (или его доверенное лицо) либо
 * председатель совета кооператива.
 */
inline bool is_personal_verification_procedure(eosio::name procedure) {
  return procedure == "passport"_n;
}
