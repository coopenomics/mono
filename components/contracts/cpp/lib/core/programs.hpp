#pragma once

#include <map>
#include <optional>

#include "../consts.hpp"
#include "utils.hpp"

using namespace eosio;

/**
 * Логика программ пайщика и кошелька.
 *
 * Источник правды по «участник ЦПП X» = `wallet::users[username].programs[]`
 * (Эпик 2). signagree добавляет запись в этот вектор, revokeagree — удаляет;
 * status="declined" в агриментах при ревоке не нужен — записи просто нет.
 *
 * Таблицы из domain/index.hpp:
 *   - soviet::programs     — реестр программ кооператива.
 *   - soviet::coagreements — мапа program_type → program_id (per-coop).
 *   - wallet::users        — подписанные программные соглашения пайщика.
 */

program get_program_or_fail(eosio::name coopname, uint64_t program_id) {
  programs_index programs(_soviet, coopname.value);
  print("program_id: ", program_id);
  auto program_itr = programs.find(program_id);
  eosio::check(program_itr != programs.end(), "Программа не найдена");

  return program(*program_itr);
}

inline bool has_signed_program_agreement(eosio::name coopname, eosio::name username, uint64_t program_id) {
  WalletTables::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);
  if (user_it == users.end()) return false;
  for (const auto &p : user_it->programs) {
    if (p.program_id == program_id) return true;
  }
  return false;
}

bool is_participant_of_cpp_by_program_id(eosio::name coopname, eosio::name username, uint64_t program_id) {
  return has_signed_program_agreement(coopname, username, program_id);
}

bool is_valid_participant_of_program_by_type(eosio::name coopname, eosio::name username,
                                             eosio::name program_type) {
  coagreements_index coagreements(_soviet, coopname.value);
  auto coagreement_row = coagreements.find(program_type.value);
  if (coagreement_row == coagreements.end())
    return false;

  programs_index programs(_soviet, coopname.value);
  auto exist = programs.find(coagreement_row->program_id);
  if (exist == programs.end())
    return false;

  return has_signed_program_agreement(coopname, username, exist->id);
}

struct ProgramInfo {
  uint64_t program_id;
  uint64_t draft_id;
};

/**
 * Реестр целевых потребительских программ: тип → (program_id, draft_id).
 *
 * Оба значения — константы протокола, а не настройка кооператива, и наружу не
 * отдаются: `createprog` не принимает их параметрами, чтобы кооператив не мог
 * подставить произвольный документ. ЦПП жёстко связана со своей офертой.
 *
 * `program_id` обязан совпадать во всех кооперативах — на него ссылается реестр
 * кошельков ledger2 (`LEDGER2_USER_SHARED_PROGRAM_MAPPING`: `w.mkt.*` → 2,
 * `w.cap.blago` → 4, `w.cap.gen` → 3).
 *
 * `draft_id` — шаблон оферты, которую подписывает ПАЙЩИК при вступлении в ЦПП
 * (не положение о программе: его утверждает совет). По нему `wallet::signagree`
 * фиксирует версию подписи, а рабочий стол просит переподписать, когда оферта
 * обновилась. Значение обязано совпадать с реестром документов в cooptypes:
 *   1    — WalletAgreement,
 *   1102 — MarketplaceOffer (было 699 — «Согласие с условиями ЦПП «СОСЕДИ»»,
 *          шаблон от прежней версии программы),
 *   996  — GeneratorOffer (было 0 — при нуле signagree не сверяет шаблон и
 *          пишет version=0, из-за чего переподпись не запрашивалась никогда),
 *   1000 — BlagorostOffer,
 *   3002 — EducationParentOffer (ЦПП «Образование», обучение),
 *   3004 — EducationTeacherOffer (ЦПП «Образование», преподавание).
 */
static const std::map<eosio::name, ProgramInfo> program_map = {
    {_wallet_program, {1, 1}},
    {_marketplace_program, {2, 1102}},
    {_source_program, {3, 996}},
    {_capital_program, {4, 1000}},
    {_eduparent_program, {5, 3002}},
    {_eduteacher_program, {6, 3004}}};

inline void check_valid_program(const eosio::name &type) {
  eosio::check(program_map.find(type) != program_map.end(), "Недопустимый тип программы");
}

inline uint64_t get_program_id(const eosio::name &type) {
  auto it = program_map.find(type);
  eosio::check(it != program_map.end(), "Недопустимый тип программы");
  return it->second.program_id;
}

inline uint64_t get_draft_id(const eosio::name &type) {
  auto it = program_map.find(type);
  eosio::check(it != program_map.end(), "Недопустимый тип программы");
  return it->second.draft_id;
}

/**
 * Открыт ли у пайщика программный кошелёк по типу программы.
 *
 * Источник — `wallet::users[username].programs[]`: пайщик считается «открывшим»
 * программу, если у него есть подписанное программное соглашение нужного
 * `program_id`. Балансы — отдельно через ledger2::userwallets, эта функция
 * только про факт открытия.
 */
bool has_program_wallet(eosio::name coopname, eosio::name username, eosio::name type) {
  return has_signed_program_agreement(coopname, username, get_program_id(type));
}
