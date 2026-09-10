#pragma once

#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "table_soviet_boards.hpp"
#include "table_soviet_participants.hpp"

boards get_board_by_id(eosio::name coopname, uint64_t board_id) {
  boards_index boards_tbl(_soviet, coopname.value);
  auto board = boards_tbl.find(board_id);

  eosio::check(board != boards_tbl.end(), "Совет не найден");

  return *board;
}

boards get_board_by_type_or_fail(eosio::name coopname, eosio::name type) {
  boards_index boards_tbl(_soviet, coopname.value);
  auto boards_by_type_index = boards_tbl.template get_index<"bytype"_n>();
  auto exist = boards_by_type_index.find(type.value);

  eosio::check(exist != boards_by_type_index.end(), "Совет не найден");

  return *exist;
}

bool check_for_exist_board_by_type(eosio::name coopname, eosio::name type) {
  boards_index boards_tbl(_soviet, coopname.value);

  auto boards_by_type_index = boards_tbl.template get_index<"bytype"_n>();

  auto exist = boards_by_type_index.find(type.value);

  if (exist != boards_by_type_index.end())
    return true;
  else
    return false;
}

bool is_valid_participant(eosio::name coopname, eosio::name username) {
  participants_index participants_tbl(_soviet, coopname.value);
  auto participant_row = participants_tbl.find(username.value);
  accounts_index accounts_tbl(_registrator, _registrator.value);
  auto account_row = accounts_tbl.find(username.value);

  if (participant_row != participants_tbl.end() && participant_row->status == "accepted"_n) {
    return true;
  }

  return false;
}

participant get_participant_or_fail(eosio::name coopname, eosio::name username) {
  participants_index participants_tbl(_soviet, coopname.value);
  auto participant_row = participants_tbl.find(username.value);
  eosio::check(participant_row != participants_tbl.end(), "Пайщик не найден в кооперативе");
  eosio::check(participant_row->status != "blocked"_n, "Пайщик заблокирован");

  return *participant_row;
}

/**
 * @brief Действующий пайщик без начатого выхода из кооператива.
 *
 * Пока заявление на выход подано и не завершено (запись в registrator::exits
 * в любом статусе), пайщик формально ещё в реестре, но новых обязательств
 * открывать не должен: сумма возврата считается при одобрении советом, а
 * после выплаты аккаунт блокируется — всё, что появилось после подачи
 * заявления, осталось бы на заблокированном аккаунте (задача 99D-16).
 * Действия, завершающие уже начатое (подтверждение кассира, восстановление
 * ключа), по-прежнему зовут `get_participant_or_fail`.
 */
participant get_active_participant_or_fail(eosio::name coopname, eosio::name username) {
  auto participant = get_participant_or_fail(coopname, username);
  Registrator::exits_index exits(_registrator, coopname.value);
  eosio::check(exits.find(username.value) == exits.end(),
               "Пайщик подал заявление на выход из кооператива — новые действия недоступны до его рассмотрения");
  return participant;
}
